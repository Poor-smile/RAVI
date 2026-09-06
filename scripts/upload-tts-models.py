"""Upload Raavi TTS release artifacts over pinned explicit FTPS.

The host currently presents an expired certificate, so normal PKI validation
cannot be used. Transport remains encrypted and the server SPKI is pinned.
Credentials are read interactively and never accepted as CLI arguments.
"""

from __future__ import annotations

import argparse
import base64
import ftplib
import getpass
import hashlib
import ssl
import time
from pathlib import Path, PurePosixPath

from cryptography import x509
from cryptography.hazmat.primitives import serialization


PINNED_SPKI = "sha256//GdmwbWg8FJIEwvdpB4M4Y1Da1rzptmHhWMULDDT25ys="


class SessionPinnedFTP_TLS(ftplib.FTP_TLS):
    """Reuse the control TLS session for ProFTPD data connections."""

    def ntransfercmd(self, cmd: str, rest: str | None = None):
        conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        if self._prot_p:
            conn = self.context.wrap_socket(
                conn,
                server_hostname=self.host,
                session=self.sock.session,
            )
        return conn, size


def verify_control_pin(client: SessionPinnedFTP_TLS) -> None:
    certificate = x509.load_der_x509_certificate(client.sock.getpeercert(binary_form=True))
    spki = certificate.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    actual = "sha256//" + base64.b64encode(hashlib.sha256(spki).digest()).decode("ascii")
    if actual != PINNED_SPKI:
        raise ssl.SSLError("FTPS server public-key pin does not match the approved host")


def ensure_directory(client: SessionPinnedFTP_TLS, remote: PurePosixPath) -> None:
    client.cwd("/")
    for part in remote.parts:
        if part == "/":
            continue
        try:
            client.cwd(part)
        except ftplib.error_perm:
            client.mkd(part)
            client.cwd(part)


def connect_client(host: str, username: str, password: str, context: ssl.SSLContext):
    client = SessionPinnedFTP_TLS(context=context, timeout=90)
    client.connect(host, 21)
    client.auth()
    verify_control_pin(client)
    client.login(username, password)
    client.prot_p()
    return client


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="3264450084.cloudydl.com")
    parser.add_argument("--local-root", type=Path, required=True)
    parser.add_argument(
        "--remote-root",
        type=PurePosixPath,
        default=PurePosixPath("/domains/pz24978.parspack.net/public_html/downloads/raavi/tts/v1"),
    )
    parser.add_argument("--list", action="store_true", help="list the account root without uploading")
    parser.add_argument("--relocate-from", type=PurePosixPath)
    parser.add_argument("--relocate-to", type=PurePosixPath)
    args = parser.parse_args()

    username = input("FTP username: ").strip()
    password = getpass.getpass("FTP password: ")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    if args.relocate_from or args.relocate_to:
        if not args.relocate_from or not args.relocate_to:
            parser.error("--relocate-from and --relocate-to must be provided together")
        client = connect_client(args.host, username, password, context)
        try:
            ensure_directory(client, args.relocate_to.parent)
            try:
                client.cwd(str(args.relocate_to))
            except ftplib.error_perm:
                client.rename(str(args.relocate_from), str(args.relocate_to))
                print(f"Relocated {args.relocate_from} to {args.relocate_to}")
                return 0
            raise FileExistsError(f"Refusing to overwrite existing remote path: {args.relocate_to}")
        finally:
            client.close()

    if args.list:
        client = connect_client(args.host, username, password, context)
        try:
            for name in client.nlst(str(args.remote_root)):
                print(name)
            return 0
        finally:
            client.close()

    files = sorted(path for path in args.local_root.rglob("*") if path.is_file())
    if not files:
        raise FileNotFoundError(f"No release files found below {args.local_root}")
    for source in files:
        relative = PurePosixPath(source.relative_to(args.local_root).as_posix())
        destination = args.remote_root / relative
        total = source.stat().st_size
        for attempt in range(1, 31):
            sent = 0

            def progress(chunk: bytes) -> None:
                nonlocal sent
                sent += len(chunk)
                if sent == total or sent % (8 * 1024 * 1024) < len(chunk):
                    print(f"Uploading {relative}: {sent * 100 / max(1, total):.0f}%", flush=True)

            client = None
            try:
                client = connect_client(args.host, username, password, context)
                ensure_directory(client, destination.parent)
                client.voidcmd("TYPE I")
                if relative.as_posix() == "manifest.json":
                    temporary = f".{destination.name}.{time.time_ns()}.tmp"
                    with source.open("rb") as handle:
                        client.storbinary(
                            f"STOR {temporary}",
                            handle,
                            blocksize=256 * 1024,
                            callback=progress,
                        )
                    if int(client.size(temporary) or 0) != total:
                        raise OSError("temporary manifest upload has an invalid size")
                    try:
                        client.delete(destination.name)
                    except ftplib.error_perm:
                        pass
                    client.rename(temporary, destination.name)
                    print(f"Uploaded {relative} atomically")
                    break
                try:
                    offset = int(client.size(destination.name) or 0)
                except ftplib.error_perm:
                    offset = 0
                if offset > total:
                    client.delete(destination.name)
                    offset = 0
                if offset == total:
                    print(f"Already uploaded {relative}")
                    break
                sent = offset
                with source.open("rb") as handle:
                    handle.seek(offset)
                    client.storbinary(
                        f"STOR {destination.name}",
                        handle,
                        blocksize=256 * 1024,
                        callback=progress,
                        rest=offset or None,
                    )
                print(f"Uploaded {relative}")
                break
            except (EOFError, OSError, ftplib.Error, ssl.SSLError) as error:
                if attempt == 30:
                    raise
                print(f"Retrying {relative} with resume after data-channel error ({attempt}/30): {error}", flush=True)
                time.sleep(min(45, 6 + attempt * 3))
            finally:
                client and client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
