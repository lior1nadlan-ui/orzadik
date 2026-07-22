#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Upload the optimised catalog images to the Supabase Storage bucket
`product-images` (created in migration 20260531122102), under `catalog/`.

    export SUPABASE_SERVICE_ROLE_KEY=...        # never commit this
    python scripts/upload_product_images.py \
        --project-ref deyidkzuvwniioxjisdr \
        --dir .catalog-images

The service-role key is read from the environment only - it is never taken as a
command-line argument, so it does not leak into shell history or process lists.
Get it from the Supabase dashboard: Project Settings -> API -> service_role.

Object paths are deterministic, so the URLs written by import_art_judaica.py
(--image-base .../product-images/catalog/) are valid as soon as this finishes:

    https://<ref>.supabase.co/storage/v1/object/public/product-images/catalog/<n>.webp

Resumable: pass --skip-existing (default) to list the bucket first and upload
only what is missing.
"""

import argparse
import concurrent.futures as cf
import json
import os
import sys
import time
import urllib.error
import urllib.request

BUCKET = "product-images"
PREFIX = "catalog"


def api(base, key, method, path, data=None, ctype=None, extra=None):
    rq = urllib.request.Request(f"{base}{path}", method=method, data=data)
    rq.add_header("Authorization", f"Bearer {key}")
    rq.add_header("apikey", key)
    if ctype:
        rq.add_header("Content-Type", ctype)
    for k, v in (extra or {}).items():
        rq.add_header(k, v)
    with urllib.request.urlopen(rq, timeout=120) as r:
        return r.status, r.read()


def list_existing(base, key):
    """Page through the bucket so an interrupted run can resume cheaply."""
    seen, offset = set(), 0
    while True:
        body = json.dumps({"prefix": PREFIX + "/", "limit": 1000,
                           "offset": offset}).encode()
        try:
            _, raw = api(base, key, "POST", f"/storage/v1/object/list/{BUCKET}",
                         body, "application/json")
        except urllib.error.HTTPError as e:
            print(f"  list failed ({e.code}) - uploading everything", file=sys.stderr)
            return set()
        batch = json.loads(raw)
        if not batch:
            break
        seen.update(o["name"] for o in batch)
        offset += len(batch)
        if len(batch) < 1000:
            break
    return seen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-ref", required=True)
    ap.add_argument("--dir", default=".catalog-images")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--skip-existing", action="store_true", default=True)
    args = ap.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY is not set in the environment.\n"
                 "Supabase dashboard -> Project Settings -> API -> service_role")

    base = f"https://{args.project_ref}.supabase.co"
    files = sorted(f for f in os.listdir(args.dir) if f.endswith(".webp"))
    if not files:
        sys.exit(f"no .webp files in {args.dir} - run fetch_product_images.py first")
    print(f"{len(files)} local images")

    if args.skip_existing:
        have = list_existing(base, key)
        print(f"{len(have)} already in the bucket")
        files = [f for f in files if f not in have]
    print(f"{len(files)} to upload")
    if not files:
        return

    stats = {"ok": 0, "fail": 0}
    t0 = time.time()
    failures = []

    def put(name):
        path = os.path.join(args.dir, name)
        with open(path, "rb") as fh:
            blob = fh.read()
        for attempt in range(3):
            try:
                api(base, key, "POST",
                    f"/storage/v1/object/{BUCKET}/{PREFIX}/{name}",
                    blob, "image/webp",
                    {"x-upsert": "true", "cache-control": "public, max-age=31536000"})
                return name, True
            except urllib.error.HTTPError as e:
                if e.code in (409,):          # already exists
                    return name, True
                if attempt == 2:
                    print(f"  {name}: HTTP {e.code} {e.read()[:120]}", file=sys.stderr)
                    return name, False
            except Exception as e:
                if attempt == 2:
                    print(f"  {name}: {e}", file=sys.stderr)
                    return name, False
            time.sleep(2 * (attempt + 1))
        return name, False

    with cf.ThreadPoolExecutor(args.concurrency) as ex:
        for i, (name, ok) in enumerate(ex.map(put, files), 1):
            stats["ok" if ok else "fail"] += 1
            if not ok:
                failures.append(name)
            if i % 250 == 0:
                el = time.time() - t0
                print(f"  {i}/{len(files)}  ok={stats['ok']} fail={stats['fail']}  "
                      f"{el:.0f}s ({i/el:.1f}/s)", flush=True)

    print(f"\ndone: {stats['ok']} uploaded, {stats['fail']} failed "
          f"in {time.time()-t0:.0f}s")
    print(f"public URL base:\n  {base}/storage/v1/object/public/"
          f"{BUCKET}/{PREFIX}/")
    if failures:
        print(f"failed: {failures[:10]}{' ...' if len(failures) > 10 else ''}")
        sys.exit(1)


if __name__ == "__main__":
    main()
