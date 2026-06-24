import sqlite3
import threading
from contextlib import contextmanager

DB_PATH = "rewards.db"

write_lock = threading.Lock()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id             TEXT PRIMARY KEY,
                username       TEXT NOT NULL,
                balance        REAL NOT NULL DEFAULT 0,
                total_earned   REAL NOT NULL DEFAULT 0,
                total_spent    REAL NOT NULL DEFAULT 0,
                txn_count      INTEGER NOT NULL DEFAULT 0,
                created_at     TEXT NOT NULL DEFAULT (datetime('now')),
                last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                user_id         TEXT NOT NULL,
                amount          REAL NOT NULL,
                type            TEXT NOT NULL CHECK(type IN ('earn', 'spend')),
                idempotency_key TEXT NOT NULL UNIQUE,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                key           TEXT PRIMARY KEY,
                user_id       TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_txn_user_time
            ON transactions(user_id, created_at)
        """)

        conn.commit()

        conn.executemany("""
            INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)
        """, [
            ("user_001", "alice"),
            ("user_002", "bob"),
            ("user_003", "carol"),
            ("user_004", "dave"),
            ("user_005", "eve"),
        ])
        conn.commit()

    print("✅ Database initialized")