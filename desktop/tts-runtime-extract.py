"""Safely extract a hosted Raavi Python runtime bundle.

This script runs with Raavi's already-verified embedded Python. It streams
large files instead of loading an entire Torch bundle into Electron memory.
"""

from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path


def extract(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if not target.is_relative_to(root) or target == root:
                raise RuntimeError(f"unsafe runtime archive path: {member.filename}")
            unix_kind = (member.external_attr >> 16) & 0o170000
            if unix_kind == 0o120000:
                raise RuntimeError(f"runtime archive contains a symlink: {member.filename}")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: tts-runtime-extract.py ARCHIVE DESTINATION")
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
