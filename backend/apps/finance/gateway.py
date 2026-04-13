from __future__ import annotations

import base64
import hashlib
import hmac
import json
from urllib import request, error
from django.conf import settings


class RazorpayGatewayError(Exception):
    pass


def razorpay_is_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _auth_header() -> str:
    token = base64.b64encode(f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


def create_razorpay_order(*, amount_paise: int, currency: str, receipt: str, notes: dict | None = None) -> dict:
    if not razorpay_is_configured():
        raise RazorpayGatewayError("Razorpay keys are not configured.")

    payload = json.dumps(
        {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {},
        }
    ).encode("utf-8")
    req = request.Request(
        f"{settings.RAZORPAY_BASE_URL}/orders",
        data=payload,
        headers={
            "Authorization": _auth_header(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RazorpayGatewayError(body or "Unable to create Razorpay order.") from exc
    except error.URLError as exc:
        raise RazorpayGatewayError("Unable to reach Razorpay.") from exc


def verify_checkout_signature(*, order_id: str, payment_id: str, signature: str) -> bool:
    if not settings.RAZORPAY_KEY_SECRET:
        return False
    generated = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated, signature)


def verify_webhook_signature(*, body: bytes, signature: str) -> bool:
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        return False
    generated = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated, signature)
