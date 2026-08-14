import base64
import secrets
from typing import Any

from django.conf import settings
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.request import Request

CAPTCHA_LENGTH = 4
SESSION_KEY = "registration_captchas"


def generate_numeric_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(CAPTCHA_LENGTH))


def _code_digest(challenge_id: str, code: str) -> str:
    return salted_hmac(
        "bakeops.registration-captcha",
        f"{challenge_id}:{code}",
    ).hexdigest()


def _render_svg(code: str) -> str:
    text_nodes: list[str] = []
    for index, digit in enumerate(code):
        x = 24 + index * 31 + secrets.randbelow(7)
        y = 38 + secrets.randbelow(9)
        rotation = secrets.randbelow(25) - 12
        text_nodes.append(
            f'<text x="{x}" y="{y}" transform="rotate({rotation} {x} {y})">{digit}</text>'
        )

    noise_lines: list[str] = []
    for _ in range(5):
        noise_lines.append(
            '<line '
            f'x1="{secrets.randbelow(150)}" y1="{secrets.randbelow(52)}" '
            f'x2="{secrets.randbelow(150)}" y2="{secrets.randbelow(52)}" />'
        )

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="52" viewBox="0 0 150 52">'
        '<rect width="150" height="52" rx="8" fill="#f4f1ea" />'
        '<g stroke="#b8aa93" stroke-width="1.2" opacity="0.65">'
        f'{"".join(noise_lines)}'
        '</g>'
        '<g fill="#24211d" font-family="Arial, sans-serif" font-size="30" font-weight="700">'
        f'{"".join(text_nodes)}'
        '</g>'
        '</svg>'
    )


def create_registration_captcha(request: Request) -> dict[str, Any]:
    now = int(timezone.now().timestamp())
    ttl_seconds = settings.REGISTRATION_CAPTCHA_TTL_SECONDS
    challenges = {
        key: value
        for key, value in request.session.get(SESSION_KEY, {}).items()
        if value.get("expires_at", 0) > now
    }
    challenge_id = secrets.token_urlsafe(18)
    code = generate_numeric_code()
    challenges[challenge_id] = {
        "digest": _code_digest(challenge_id, code),
        "expires_at": now + ttl_seconds,
    }
    request.session[SESSION_KEY] = dict(list(challenges.items())[-5:])
    request.session.modified = True

    svg = _render_svg(code)
    encoded_svg = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return {
        "challenge_id": challenge_id,
        "image_data_url": f"data:image/svg+xml;base64,{encoded_svg}",
        "expires_in": ttl_seconds,
    }


def consume_registration_captcha(request: Request, challenge_id: str, answer: str) -> bool:
    now = int(timezone.now().timestamp())
    challenges = request.session.get(SESSION_KEY, {})
    challenge = challenges.pop(challenge_id, None)
    request.session[SESSION_KEY] = {
        key: value for key, value in challenges.items() if value.get("expires_at", 0) > now
    }
    request.session.modified = True

    normalized_answer = answer.strip()
    if (
        challenge is None
        or challenge.get("expires_at", 0) <= now
        or len(normalized_answer) != CAPTCHA_LENGTH
        or not normalized_answer.isdigit()
    ):
        return False

    return constant_time_compare(
        challenge.get("digest", ""),
        _code_digest(challenge_id, normalized_answer),
    )
