"""Email sender abstraction.

Two backends:
  - ConsoleEmailSender (dev): logs the message + OTP. Zero-config.
  - ResendEmailSender (prod): POSTs to https://api.resend.com/emails.

Pick via `settings.email_provider` ("console" or "resend").
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class EmailSender(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, html: str, text: str) -> None: ...


class ConsoleEmailSender(EmailSender):
    """Dev-only — never hits the wire. Logs the message body so the OTP
    is discoverable during local development."""

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        logger.info(
            "[email:console] to=%s subject=%r\n----- TEXT -----\n%s\n----- END -----",
            to, subject, text,
        )


class ResendEmailSender(EmailSender):
    def __init__(self, api_key: str, from_addr: str) -> None:
        self._key = api_key
        self._from = from_addr

    async def send(self, *, to: str, subject: str, html: str, text: str) -> None:
        async with httpx.AsyncClient(timeout=15.0) as http:
            res = await http.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self._key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": self._from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
            )
            if res.status_code >= 400:
                logger.error("resend.send failed %s: %s", res.status_code, res.text[:300])
                raise RuntimeError(f"resend rejected {res.status_code}")


def build_email_sender(settings: Settings) -> EmailSender:
    provider = (settings.email_provider or "console").lower()
    if provider == "resend":
        if not settings.resend_api_key:
            logger.warning("email_provider=resend but resend_api_key empty; falling back to console")
            return ConsoleEmailSender()
        return ResendEmailSender(settings.resend_api_key, settings.email_from)
    return ConsoleEmailSender()


OTP_EMAIL_SUBJECT = "Your Clarifyd verification code"

OTP_EMAIL_HTML = """\
<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
  <h1 style="font-size: 22px; color: #1E3A8A; margin: 0 0 12px;">Welcome to Clarifyd.</h1>
  <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
    Use the code below to finish signing in. It expires in 10 minutes.
  </p>
  <div style="background: linear-gradient(135deg, #3525cd, #7c3aed); color: #fff;
              font-size: 32px; font-weight: 700; letter-spacing: 12px;
              text-align: center; padding: 24px; border-radius: 16px; font-family: monospace;">
    {otp}
  </div>
  <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0; line-height: 1.6;">
    If you didn't request this, ignore this email. Someone may have typed your address by mistake — no account will be created without this code.
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 11px; color: #94a3b8; margin: 0;">
    Clarifyd · Decision-support, not legal advice.
  </p>
</body></html>
"""

OTP_EMAIL_TEXT = (
    "Your Clarifyd verification code: {otp}\n\n"
    "Enter this 6-digit code on the verification page. It expires in 10 minutes.\n\n"
    "If you didn't request this, ignore the email.\n\n"
    "— Clarifyd"
)


def render_otp_email(otp: str) -> tuple[str, str]:
    return (OTP_EMAIL_HTML.format(otp=otp), OTP_EMAIL_TEXT.format(otp=otp))
