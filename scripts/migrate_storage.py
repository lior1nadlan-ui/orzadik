#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Copy the store's existing product images out of the old Lovable-owned Supabase
project and into the new one, then repoint the database rows at the new host.

Every product_images.url and products.thumbnail_url restored from the old
project still pointed at `deyidkzuvwniioxjisdr` storage. That project is owned
by a cancelled Lovable subscription - if it is deprovisioned, every pre-existing
product loses its images even though the database now lives elsewhere.

    python scripts/migrate_storage.py --old-ref deyidkzuvwniioxjisdr

Reads SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL / SUPABASE_PROJECT_REF from
.deploy-secrets. Resumable and idempotent: objects already present in the target
bucket are skipped, and the URL rewrite only touches rows still on the old host.
"""

import argparse
import concurrent.futures as cf
import io
import os
import sys
import time
import urllib.error
import urllib.request

BUCKET = "product-images"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"


def load_secrets(path="E:/פרוייקט ליאור בן עמי/.deploy-secrets"):
    return dict(l.strip().split("=", 1)
                for l in io.open(path, encoding="utf-8") if "=" in l)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old-ref", required=True)
    ap.add_argument("--secrets", default="E:/פרוייקט ליאור בן עמי/.deploy-secrets")
    ap.add_argument("--concurrency", type=int, default=6)
    args = ap.parse_args()

    import psycopg
    sec = load_secrets(args.secrets)
    key = sec["SUPABASE_SERVICE_ROLE_KEY"]
    new_ref = sec["SUPABASE_PROJECT_REF"]
    old_host = f"https://{args.old_ref}.supabase.co"
    new_host = f"https://{new_ref}.supabase.co"

    with psycopg.connect(sec["SUPABASE_DB_URL"], connect_timeout=60) as cx:
        with cx.cursor() as cur:
            cur.execute("""
                select distinct url from (
                    select url from product_images where url like %s
                    union
                    select thumbnail_url from products where thumbnail_url like %s
                ) t where url is not null
            """, (f"%{args.old_ref}%", f"%{args.old_ref}%"))
            urls = [r[0] for r in cur.fetchall()]
    print(f"{len(urls)} distinct objects still on the old project")
    if not urls:
        return

    def obj_path(u):
        return u.split(f"/object/public/{BUCKET}/", 1)[1]

    def copy(u):
        path = obj_path(u)
        # skip if the target already has it
        try:
            head = urllib.request.Request(
                f"{new_host}/storage/v1/object/public/{BUCKET}/{path}",
                method="HEAD", headers={"User-Agent": UA})
            with urllib.request.urlopen(head, timeout=30) as r:
                if r.status == 200:
                    return u, "skip"
        except Exception:
            pass
        try:
            rq = urllib.request.Request(u, headers={"User-Agent": UA})
            with urllib.request.urlopen(rq, timeout=90) as r:
                blob = r.read()
                ctype = r.headers.get("Content-Type", "application/octet-stream")
        except Exception as e:
            return u, f"download-failed {e}"
        for attempt in range(3):
            try:
                up = urllib.request.Request(
                    f"{new_host}/storage/v1/object/{BUCKET}/{path}",
                    method="POST", data=blob,
                    headers={"Authorization": f"Bearer {key}", "apikey": key,
                             "Content-Type": ctype, "x-upsert": "true",
                             "cache-control": "public, max-age=31536000"})
                urllib.request.urlopen(up, timeout=120)
                return u, "ok"
            except urllib.error.HTTPError as e:
                if e.code == 409:
                    return u, "skip"
                if attempt == 2:
                    return u, f"upload-failed {e.code}"
            except Exception as e:
                if attempt == 2:
                    return u, f"upload-failed {e}"
            time.sleep(2 * (attempt + 1))
        return u, "upload-failed"

    stats = {}
    t0 = time.time()
    with cf.ThreadPoolExecutor(args.concurrency) as ex:
        for i, (u, st) in enumerate(ex.map(copy, urls), 1):
            k = st.split()[0]
            stats[k] = stats.get(k, 0) + 1
            if k not in ("ok", "skip"):
                print(f"  {st}  {u}", file=sys.stderr)
            if i % 100 == 0:
                print(f"  {i}/{len(urls)}  {stats}  {time.time()-t0:.0f}s", flush=True)
    print(f"\ncopy done: {stats} in {time.time()-t0:.0f}s")

    failed = stats.get("download-failed", 0) + stats.get("upload-failed", 0)
    if failed:
        print(f"{failed} objects failed - NOT rewriting urls; re-run first")
        sys.exit(1)

    with psycopg.connect(sec["SUPABASE_DB_URL"], connect_timeout=60) as cx:
        with cx.cursor() as cur:
            cur.execute("update product_images set url = replace(url,%s,%s) "
                        "where url like %s",
                        (args.old_ref, new_ref, f"%{args.old_ref}%"))
            a = cur.rowcount
            cur.execute("update products set thumbnail_url = replace(thumbnail_url,%s,%s) "
                        "where thumbnail_url like %s",
                        (args.old_ref, new_ref, f"%{args.old_ref}%"))
            b = cur.rowcount
        cx.commit()
    print(f"rewrote {a} product_images rows and {b} product thumbnails")


if __name__ == "__main__":
    main()
