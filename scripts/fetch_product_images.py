#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download the ART Judaica product images and re-encode them as WebP so the store
serves its own assets instead of hot-linking the supplier's host.

The supplier ships ~2.1 GB of raw JPEG (mean 280 KB, largest 14.9 MB). Resizing
to MAX_EDGE and encoding to WebP brings that down by roughly 85% with no visible
loss at storefront sizes.

    python scripts/fetch_product_images.py \
        --image-status image_status.json \
        --out .catalog-images

Resumable: files that already exist are skipped, so an interrupted run can just
be restarted. Concurrency is deliberately low - the supplier host rate-limits
aggressively and starts serving HTML error pages instead of images when pushed.

Then upload with scripts/upload_product_images.py.
"""

import argparse
import concurrent.futures as cf
import io
import json
import os
import sys
import time
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
MAX_EDGE = 1200
QUALITY = 82


def fetch(url, retries=3):
    for attempt in range(retries + 1):
        try:
            rq = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(rq, timeout=60) as r:
                ctype = r.headers.get("Content-Type", "")
                if not ctype.startswith("image"):
                    return None          # supplier returns an HTML 404 page
                return r.read()
        except Exception:
            if attempt == retries:
                return None
            time.sleep(2 * (attempt + 1))
    return None


def convert(raw, dest):
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "P"):
        # flatten onto white - product shots are photographed on white anyway
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    im.save(dest, "WEBP", quality=QUALITY, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image-status", required=True,
                    help="JSON produced by import_art_judaica.py --validate-images")
    ap.add_argument("--out", default=".catalog-images")
    ap.add_argument("--concurrency", type=int, default=5)
    args = ap.parse_args()

    status = json.load(io.open(args.image_status, encoding="utf-8"))
    urls = sorted(u for u, v in status.items()
                  if v[0] == 200 and str(v[1]).startswith("image"))
    os.makedirs(args.out, exist_ok=True)
    print(f"{len(urls)} valid images -> {args.out}")

    todo = []
    for u in urls:
        name = os.path.basename(u).rsplit(".", 1)[0] + ".webp"
        dest = os.path.join(args.out, name)
        if not os.path.exists(dest):
            todo.append((u, dest))
    print(f"{len(urls) - len(todo)} already present, {len(todo)} to fetch")
    if not todo:
        return

    done = {"ok": 0, "fail": 0, "bytes": 0}
    t0 = time.time()

    def work(job):
        url, dest = job
        raw = fetch(url)
        if raw is None:
            return url, False, 0
        try:
            convert(raw, dest)
            return url, True, os.path.getsize(dest)
        except Exception as e:
            print(f"  convert failed {url}: {e}", file=sys.stderr)
            if os.path.exists(dest):
                os.remove(dest)
            return url, False, 0

    failures = []
    with cf.ThreadPoolExecutor(args.concurrency) as ex:
        for i, (url, ok, size) in enumerate(ex.map(work, todo), 1):
            if ok:
                done["ok"] += 1
                done["bytes"] += size
            else:
                done["fail"] += 1
                failures.append(url)
            if i % 250 == 0:
                el = time.time() - t0
                print(f"  {i}/{len(todo)}  ok={done['ok']} fail={done['fail']}  "
                      f"{done['bytes']/1024/1024:.0f}MB  {el:.0f}s  "
                      f"({i/el:.1f}/s)", flush=True)

    print(f"\ndone: {done['ok']} ok, {done['fail']} failed, "
          f"{done['bytes']/1024/1024:.0f} MB in {time.time()-t0:.0f}s")
    if failures:
        io.open(os.path.join(args.out, "_failures.txt"), "w",
                encoding="utf-8").write("\n".join(failures))
        print(f"failures listed in {args.out}/_failures.txt - re-run to retry")


if __name__ == "__main__":
    main()
