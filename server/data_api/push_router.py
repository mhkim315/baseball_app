import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, text

logger = logging.getLogger("fullcount.push")

ENABLED = os.getenv("ENABLE_PUSH_NOTIFICATIONS", "").lower() in ("1", "true", "yes")
DATABASE_URL = os.getenv("DATABASE_URL", "")

router = APIRouter(prefix="/push", tags=["push"])


class RegisterBody(BaseModel):
    token: str
    platform: str
    target_team_id: str
    app_version: Optional[str] = None


class UnregisterBody(BaseModel):
    token: str
    platform: str


def _get_engine():
    return create_engine(DATABASE_URL)


@router.post("/register")
def register(body: RegisterBody):
    if not ENABLED:
        return {"status": "push_disabled"}
    if body.platform not in ("android", "ios"):
        return {"status": "error", "message": "platform must be 'android' or 'ios'"}
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO device_tokens (token, platform, target_team_id, app_version, last_seen_at)
                    VALUES (:token, :platform, :team, :ver, NOW())
                    ON CONFLICT (token, platform)
                    DO UPDATE SET target_team_id = :team, app_version = :ver, last_seen_at = NOW()
                """),
                {"token": body.token, "platform": body.platform, "team": body.target_team_id, "ver": body.app_version or ""},
            )
        engine.dispose()
        logger.info("Push registered: %s (%s, team=%s)", body.token[:12], body.platform, body.target_team_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error("Push register failed: %s", e)
        return {"status": "error", "message": str(e)}


@router.post("/unregister")
def unregister(body: UnregisterBody):
    if not ENABLED:
        return {"status": "push_disabled"}
    try:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM device_tokens WHERE token = :token AND platform = :platform"),
                {"token": body.token, "platform": body.platform},
            )
        engine.dispose()
        logger.info("Push unregistered: %s (%s)", body.token[:12], body.platform)
        return {"status": "ok"}
    except Exception as e:
        logger.error("Push unregister failed: %s", e)
        return {"status": "error", "message": str(e)}


@router.get("/status")
def status(token: str = Query(...), platform: str = Query(...)):
    if not ENABLED:
        return {"status": "push_disabled"}
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT target_team_id, last_seen_at FROM device_tokens WHERE token = :token AND platform = :platform"),
                {"token": token, "platform": platform},
            ).fetchone()
        engine.dispose()
        if row:
            return {"status": "registered", "target_team_id": row[0], "last_seen_at": row[1].isoformat() if row[1] else None}
        return {"status": "not_found"}
    except Exception as e:
        logger.error("Push status check failed: %s", e)
        return {"status": "error", "message": str(e)}
