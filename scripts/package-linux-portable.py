from __future__ import annotations

import io
import tarfile
from pathlib import Path, PurePosixPath


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "release" / "linux-unpacked"
OUTPUT_PATH = (
    PROJECT_ROOT / "release" / "Raavi-1.0.0-linux-x64-portable.tar.gz"
)
ARCHIVE_ROOT = PurePosixPath("Raavi-1.0.0-linux-x64")
EXECUTABLES = {
    PurePosixPath("raavi"),
    PurePosixPath("chrome-sandbox"),
    PurePosixPath("chrome_crashpad_handler"),
}
README = """Raavi 1.0.0 — Linux x64 portable

1. Extract this archive:
   tar -xzf Raavi-1.0.0-linux-x64-portable.tar.gz
2. Open the extracted directory:
   cd Raavi-1.0.0-linux-x64
3. Run Raavi:
   ./raavi

This portable archive is built from the official Electron Linux x64 runtime.
For system-wide installation and desktop integration, use the AppImage or DEB
artifact built on a native Linux runner.
"""


def normalized_tar_info(info: tarfile.TarInfo) -> tarfile.TarInfo:
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"

    archive_path = PurePosixPath(info.name)
    try:
        relative_path = archive_path.relative_to(ARCHIVE_ROOT)
    except ValueError:
        relative_path = archive_path

    if info.isdir():
        info.mode = 0o755
    elif relative_path in EXECUTABLES:
        info.mode = 0o755
    elif info.issym():
        info.mode = 0o777
    else:
        info.mode = 0o644
    return info


def main() -> None:
    executable = SOURCE_DIR / "raavi"
    if not executable.is_file():
        raise SystemExit(
            "Linux unpacked build is missing. Run electron-builder --linux dir --x64 first."
        )
    with executable.open("rb") as executable_file:
        executable_magic = executable_file.read(4)
    if executable_magic != b"\x7fELF":
        raise SystemExit("The packaged Raavi executable is not a Linux ELF binary.")

    with tarfile.open(OUTPUT_PATH, "w:gz", compresslevel=6) as archive:
        archive.add(
            SOURCE_DIR,
            arcname=ARCHIVE_ROOT.as_posix(),
            recursive=True,
            filter=normalized_tar_info,
        )

        readme_bytes = README.encode("utf-8")
        readme_info = tarfile.TarInfo(
            name=(ARCHIVE_ROOT / "README-LINUX.txt").as_posix()
        )
        readme_info.size = len(readme_bytes)
        readme_info.mode = 0o644
        readme_info.uid = 0
        readme_info.gid = 0
        readme_info.uname = "root"
        readme_info.gname = "root"
        archive.addfile(readme_info, io.BytesIO(readme_bytes))

    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
