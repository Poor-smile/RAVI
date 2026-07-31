import os
import stat
import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: write_zip.py <root> <archive>", file=sys.stderr)
        return 2

    root, archive = sys.argv[1], sys.argv[2]
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for base, _, files in os.walk(root):
            for name in files:
                path = os.path.join(base, name)
                arcname = os.path.relpath(path, root).replace(os.sep, "/")
                info = zipfile.ZipInfo.from_file(path, arcname)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                with open(path, "rb") as source:
                    zip_file.writestr(
                        info,
                        source.read(),
                        compress_type=zipfile.ZIP_DEFLATED,
                    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
