"""Download a large immutable release asset with resumable HTTP ranges."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import shutil
import urllib.request
from pathlib import Path


def remote_size(url: str) -> int:
    request = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(request, timeout=60) as response:
        return int(response.headers["Content-Length"])


def fetch_part(url: str, destination: Path, start: int, end: int) -> Path:
    expected = end - start + 1
    existing = destination.stat().st_size if destination.exists() else 0
    if existing == expected:
        return destination
    if existing > expected:
        existing = 0
    request = urllib.request.Request(
        url,
        headers={"Range": f"bytes={start + existing}-{end}"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        if response.status != 206:
            raise RuntimeError(f"server ignored byte range {start}-{end}")
        with destination.open("ab" if existing else "wb") as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
    if destination.stat().st_size != expected:
        raise RuntimeError(f"incomplete byte range {start}-{end}")
    return destination


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("destination", type=Path)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--connections", type=int, default=8)
    args = parser.parse_args()

    size = remote_size(args.url)
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    chunk_size = (size + args.connections - 1) // args.connections
    ranges = [
        (index, start, min(size - 1, start + chunk_size - 1))
        for index, start in enumerate(range(0, size, chunk_size))
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.connections) as pool:
        futures = [
            pool.submit(
                fetch_part,
                args.url,
                args.destination.with_suffix(f"{args.destination.suffix}.part-{index:03d}"),
                start,
                end,
            )
            for index, start, end in ranges
        ]
        parts = [future.result() for future in futures]

    with args.destination.open("wb") as output:
        for part in parts:
            with part.open("rb") as source:
                shutil.copyfileobj(source, output, length=1024 * 1024)
    actual = sha256(args.destination)
    if actual != args.sha256.lower():
        raise RuntimeError(f"SHA-256 mismatch: {actual}")
    for part in parts:
        part.unlink()
    print(f"Downloaded {args.destination} ({size} bytes, SHA-256 verified)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
