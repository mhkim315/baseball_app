#!/usr/bin/env python3
"""One-shot migration: create device_tokens table."""
import os
import sys
import logging
from pathlib import Path

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("push_init")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is required")
    sys.exit(1)

sql_path = Path(__file__).resolve().parent / "push_init.sql"
if not sql_path.exists():
    logger.error("push_init.sql not found at %s", sql_path)
    sys.exit(1)


def main():
    engine = create_engine(DATABASE_URL)
    ddl = sql_path.read_text(encoding="utf-8")
    with engine.begin() as conn:
        for stmt in ddl.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
    logger.info("device_tokens table ready")
    engine.dispose()


if __name__ == "__main__":
    main()
