"""Vercel serverless entry — exposes the FastAPI app to @vercel/python.

Vercel's @vercel/python runtime auto-detects an ASGI callable named `app`
in this module and adapts it. No Mangum wrapper needed (Vercel ships its
own adapter).
"""

import sys
from pathlib import Path

# Vercel sets cwd to the repo root of the project; make sure `app.*`
# resolves against the backend package directory.
_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent  # /backend
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.main import app  # noqa: E402  (path setup must precede import)

__all__ = ["app"]
