import os
import time
import json
import logging

import httpx

logger = logging.getLogger("fullcount.apns")

KEY_PATH = os.getenv("APNS_KEY_PATH", "")
KEY_ID = os.getenv("APNS_KEY_ID", "")
TEAM_ID = os.getenv("APNS_TEAM_ID", "")
TOPIC = os.getenv("APNS_TOPIC", "kr.fullcount.app")

APNS_URL = "https://api.push.apple.com/3/device"


def _build_jwt() -> str:
    from jose import jws, jwk
    with open(KEY_PATH, "rb") as f:
        p8_key = f.read()
    key = jwk.construct(p8_key, algorithm="ES256")
    payload = {
        "iss": TEAM_ID,
        "iat": int(time.time()),
    }
    return jws.sign(payload, key, algorithm="ES256", extra_headers={"kid": KEY_ID})


def send_apns(token: str, payload: dict, dry_run: bool = False) -> bool:
    if not KEY_PATH or not os.path.isfile(KEY_PATH) or not KEY_ID or not TEAM_ID:
        logger.warning("APNs not configured — send skipped")
        return False
    if dry_run:
        logger.info("APNs dry_run (would send to %s...): %s", token[:12], json.dumps(payload))
        return True
    try:
        jwt = _build_jwt()
        with httpx.Client(http2=True, timeout=10) as client:
            r = client.post(
                f"{APNS_URL}/{token}",
                json=payload,
                headers={
                    "apns-push-type": "liveactivity",
                    "apns-topic": TOPIC,
                    "authorization": f"bearer {jwt}",
                    "content-type": "application/json",
                },
            )
            if r.status_code == 200:
                logger.info("APNs sent (token=%s...)", token[:12])
                return True
            else:
                logger.warning("APNs send failed (HTTP %d): %s", r.status_code, r.text)
                return False
    except Exception as e:
        logger.error("APNs send failed for %s...: %s", token[:12], e)
        return False
