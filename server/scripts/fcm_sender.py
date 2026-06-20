import os
import logging
from typing import Optional

logger = logging.getLogger("fullcount.fcm")

SERVICE_ACCOUNT_PATH = os.getenv("FCM_SERVICE_ACCOUNT_PATH", "")
_initialized = False


def _ensure_init():
    global _initialized
    if _initialized:
        return
    if not SERVICE_ACCOUNT_PATH or not os.path.isfile(SERVICE_ACCOUNT_PATH):
        logger.warning("FCM not configured — SERVICE_ACCOUNT_PATH missing or invalid")
        return
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin initialized from %s", SERVICE_ACCOUNT_PATH)
    except Exception as e:
        logger.error("FCM init failed: %s", e)


def send_fcm(token: str, payload: dict, dry_run: bool = False) -> bool:
    _ensure_init()
    if not _initialized:
        logger.warning("FCM not initialized — send skipped")
        return False
    try:
        from firebase_admin import messaging
        data = {k: str(v) for k, v in payload.items()}
        msg = messaging.Message(
            data=data,
            token=token,
            android=messaging.AndroidConfig(priority="high"),
        )
        resp = messaging.send(msg, dry_run=dry_run)
        if dry_run:
            logger.info("FCM dry_run success (message_id=%s, token=%s...)", resp, token[:12])
        else:
            logger.info("FCM sent (message_id=%s, token=%s...)", resp, token[:12])
        return True
    except Exception as e:
        logger.error("FCM send failed for %s...: %s", token[:12], e)
        return False
