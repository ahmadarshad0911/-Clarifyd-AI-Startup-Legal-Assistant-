"""Operational CLI for Clarifyd backend.

Usage from the `backend/` directory (venv activated):

    # Interactive password prompt (recommended — password never appears in shell history):
    python -m app.cli grant-admin --email ada@clarifyd.com

    # Provide password inline:
    python -m app.cli grant-admin --email ada@clarifyd.com --password 'SecretLongPw1!'

    # Generate a strong 20-char password — printed once, never stored anywhere else:
    python -m app.cli grant-admin --email ada@clarifyd.com --generate-password

    # Demote an admin to reviewer:
    python -m app.cli revoke-admin --email ada@clarifyd.com

    # Disable an account (soft delete; user can no longer log in):
    python -m app.cli disable-user --email ada@clarifyd.com

    # Re-enable an account previously disabled:
    python -m app.cli enable-user --email ada@clarifyd.com

    # List all admins:
    python -m app.cli list-admins

Every mutation is committed atomically. The CLI bypasses HTTP/auth — only
people with database credentials can run it. Audit events are appended
where appropriate so the hash chain still reflects the change.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import secrets
import string
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from app.auth.password import hash_password
from app.config import get_settings
from app.db.engine import create_engine_and_sessionmaker, dispose_engine
from app.db.models import User
from app.services.audit import append_audit_event

MIN_PASSWORD_LEN = 12


def _generate_password(length: int = 20) -> str:
    """Crypto-random password with mixed character classes."""
    if length < MIN_PASSWORD_LEN:
        length = MIN_PASSWORD_LEN
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_=+?"
    # Force at least one of each class by sampling separately then shuffling.
    required = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*-_=+?"),
    ]
    rest = [secrets.choice(alphabet) for _ in range(length - len(required))]
    chars = required + rest
    # Fisher-Yates shuffle with crypto randomness
    for i in range(len(chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        chars[i], chars[j] = chars[j], chars[i]
    return "".join(chars)


def _resolve_password(args: argparse.Namespace) -> str:
    """Pick a password from --password / --generate-password / interactive prompt."""
    if args.generate_password:
        pw = _generate_password()
        print(f"\nGENERATED PASSWORD (save now — shown only once):\n  {pw}\n")
        return pw
    if args.password:
        if len(args.password) < MIN_PASSWORD_LEN:
            print(
                f"error: password must be >= {MIN_PASSWORD_LEN} characters.",
                file=sys.stderr,
            )
            sys.exit(2)
        return args.password
    while True:
        pw = getpass.getpass(f"New password (>= {MIN_PASSWORD_LEN} chars): ")
        if len(pw) < MIN_PASSWORD_LEN:
            print(f"  -> too short ({len(pw)} chars). Try again.", file=sys.stderr)
            continue
        confirm = getpass.getpass("Confirm: ")
        if pw != confirm:
            print("  -> mismatch. Try again.", file=sys.stderr)
            continue
        return pw


async def _grant_admin(email: str, password: str) -> None:
    settings = get_settings()
    _, Session = create_engine_and_sessionmaker(settings.database_url, echo=False)
    try:
        async with Session() as session:
            row = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            existed = row is not None
            if row is None:
                row = User(
                    email=email,
                    hashed_password=hash_password(password),
                    role="admin",
                )
                session.add(row)
            else:
                row.role = "admin"
                row.hashed_password = hash_password(password)
                row.disabled_at = None  # re-enable if previously disabled
            await session.flush()
            await append_audit_event(
                session,
                action="admin.grant",
                target_type="user",
                target_id=row.id,
                actor_id=row.id,  # self-attributed since CLI bypasses auth
                payload={
                    "email": email,
                    "via": "cli",
                    "previously_existed": existed,
                },
            )
            await session.commit()
            print(
                f"OK | {'updated' if existed else 'created'} {email} -> role=admin | "
                f"user_id={row.id}"
            )
    finally:
        await dispose_engine()


async def _revoke_admin(email: str) -> None:
    settings = get_settings()
    _, Session = create_engine_and_sessionmaker(settings.database_url, echo=False)
    try:
        async with Session() as session:
            row = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if row is None:
                print(f"error: no user with email {email}", file=sys.stderr)
                sys.exit(1)
            if row.role != "admin":
                print(f"note: {email} is already role={row.role}; no change.")
                return
            row.role = "reviewer"
            await append_audit_event(
                session,
                action="admin.revoke",
                target_type="user",
                target_id=row.id,
                actor_id=row.id,
                payload={"email": email, "via": "cli"},
            )
            await session.commit()
            print(f"OK | {email} demoted admin -> reviewer | user_id={row.id}")
    finally:
        await dispose_engine()


async def _set_disabled(email: str, disable: bool) -> None:
    settings = get_settings()
    _, Session = create_engine_and_sessionmaker(settings.database_url, echo=False)
    try:
        async with Session() as session:
            row = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if row is None:
                print(f"error: no user with email {email}", file=sys.stderr)
                sys.exit(1)
            row.disabled_at = datetime.now(timezone.utc) if disable else None
            await append_audit_event(
                session,
                action="user.disable" if disable else "user.enable",
                target_type="user",
                target_id=row.id,
                actor_id=row.id,
                payload={"email": email, "via": "cli"},
            )
            await session.commit()
            state = "disabled" if disable else "enabled"
            print(f"OK | {email} {state} | user_id={row.id}")
    finally:
        await dispose_engine()


async def _list_admins() -> None:
    settings = get_settings()
    _, Session = create_engine_and_sessionmaker(settings.database_url, echo=False)
    try:
        async with Session() as session:
            rows = (
                await session.execute(
                    select(User)
                    .where(User.role == "admin")
                    .order_by(User.created_at.desc())
                )
            ).scalars().all()
            if not rows:
                print("(no admins)")
                return
            print(f"{'ID':32}  {'EMAIL':40}  {'CREATED':20}  STATUS")
            for r in rows:
                status = (
                    f"disabled@{r.disabled_at.isoformat()}"
                    if r.disabled_at
                    else "active"
                )
                print(
                    f"{r.id:32}  {r.email:40}  "
                    f"{r.created_at.isoformat()[:19]:20}  {status}"
                )
    finally:
        await dispose_engine()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="clarifyd-cli",
        description="Clarifyd backend operational CLI (admin / user management).",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_grant = sub.add_parser("grant-admin", help="Upsert a user with role=admin.")
    p_grant.add_argument("--email", required=True, help="Email address (will be lowercased).")
    pw_group = p_grant.add_mutually_exclusive_group()
    pw_group.add_argument(
        "--password",
        help=f"New password ({MIN_PASSWORD_LEN}+ chars). Omit to be prompted.",
    )
    pw_group.add_argument(
        "--generate-password",
        action="store_true",
        help="Generate a strong 20-char password (printed once).",
    )

    p_revoke = sub.add_parser("revoke-admin", help="Demote an admin to reviewer.")
    p_revoke.add_argument("--email", required=True)

    p_dis = sub.add_parser("disable-user", help="Soft-disable an account (sets disabled_at).")
    p_dis.add_argument("--email", required=True)

    p_en = sub.add_parser("enable-user", help="Clear disabled_at on an account.")
    p_en.add_argument("--email", required=True)

    sub.add_parser("list-admins", help="Print all users with role=admin.")

    args = parser.parse_args(argv)
    cmd = args.cmd

    if cmd == "grant-admin":
        email = args.email.strip().lower()
        password = _resolve_password(args)
        asyncio.run(_grant_admin(email, password))
    elif cmd == "revoke-admin":
        asyncio.run(_revoke_admin(args.email.strip().lower()))
    elif cmd == "disable-user":
        asyncio.run(_set_disabled(args.email.strip().lower(), disable=True))
    elif cmd == "enable-user":
        asyncio.run(_set_disabled(args.email.strip().lower(), disable=False))
    elif cmd == "list-admins":
        asyncio.run(_list_admins())
    else:  # pragma: no cover - argparse should reject
        parser.print_help()
        sys.exit(2)


if __name__ == "__main__":
    main()
