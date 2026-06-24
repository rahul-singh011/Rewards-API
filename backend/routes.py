import json
import sqlite3
from fastapi import APIRouter, HTTPException
from database import get_db, write_lock
from models import TransactionRequest, TransactionResponse, SummaryResponse, RankingResponse
from ranking import compute_rankings

router = APIRouter()

MAX_TXNS_PER_HOUR = 10



@router.post("/transaction", response_model=TransactionResponse, status_code=201)
def post_transaction(req: TransactionRequest):

    with get_db() as conn:

    
        existing = conn.execute(
            "SELECT response_json FROM idempotency_keys WHERE key = ? AND user_id = ?",
            (req.idempotency_key, req.user_id)
        ).fetchone()

        if existing:
            return json.loads(existing["response_json"])

        user = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (req.user_id,)
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail=f"User '{req.user_id}' not found")


        recent_count = conn.execute("""
            SELECT COUNT(*) as cnt
            FROM transactions
            WHERE user_id = ?
              AND created_at >= datetime('now', '-1 hour')
        """, (req.user_id,)).fetchone()["cnt"]

        if recent_count >= MAX_TXNS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {MAX_TXNS_PER_HOUR} transactions per hour."
            )

   
        if req.type == "spend" and req.amount > user["balance"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance. Current: {user['balance']}, Requested: {req.amount}"
            )

        with write_lock:
            try:
                conn.execute("BEGIN IMMEDIATE")

                user = conn.execute(
                    "SELECT * FROM users WHERE id = ?",
                    (req.user_id,)
                ).fetchone()

                if req.type == "spend" and req.amount > user["balance"]:
                    conn.execute("ROLLBACK")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient balance (updated). Current: {user['balance']}"
                    )

                conn.execute("""
                    INSERT INTO transactions (user_id, amount, type, idempotency_key)
                    VALUES (?, ?, ?, ?)
                """, (req.user_id, req.amount, req.type, req.idempotency_key))

                txn_id = conn.execute(
                    "SELECT id FROM transactions WHERE idempotency_key = ?",
                    (req.idempotency_key,)
                ).fetchone()["id"]

                if req.type == "earn":
                    conn.execute("""
                        UPDATE users
                        SET balance        = balance + ?,
                            total_earned   = total_earned + ?,
                            txn_count      = txn_count + 1,
                            last_active_at = datetime('now')
                        WHERE id = ?
                    """, (req.amount, req.amount, req.user_id))
                    new_balance = round(user["balance"] + req.amount, 2)
                else:
                    conn.execute("""
                        UPDATE users
                        SET balance        = balance - ?,
                            total_spent    = total_spent + ?,
                            txn_count      = txn_count + 1,
                            last_active_at = datetime('now')
                        WHERE id = ?
                    """, (req.amount, req.amount, req.user_id))
                    new_balance = round(user["balance"] - req.amount, 2)

                response_data = {
                    "transaction_id": txn_id,
                    "user_id":        req.user_id,
                    "amount":         req.amount,
                    "type":           req.type,
                    "new_balance":    new_balance,
                    "message":        f"Successfully {'earned' if req.type == 'earn' else 'spent'} {req.amount} points"
                }

                conn.execute("""
                    INSERT INTO idempotency_keys (key, user_id, response_json)
                    VALUES (?, ?, ?)
                """, (req.idempotency_key, req.user_id, json.dumps(response_data)))

                conn.execute("COMMIT")
                return response_data

            except HTTPException:
                try:
                    conn.execute("ROLLBACK")
                except Exception:
                    pass
                raise

            except sqlite3.IntegrityError:
                conn.execute("ROLLBACK")
                stored = conn.execute(
                    "SELECT response_json FROM idempotency_keys WHERE key = ?",
                    (req.idempotency_key,)
                ).fetchone()
                if stored:
                    return json.loads(stored["response_json"])
                raise HTTPException(status_code=409, detail="Duplicate key conflict")

            except Exception as e:
                conn.execute("ROLLBACK")
                raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{user_id}", response_model=SummaryResponse)
def get_summary(user_id: str):

    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")

        return {
            "user_id":       user["id"],
            "username":      user["username"],
            "balance":       round(user["balance"], 2),
            "total_earned":  round(user["total_earned"], 2),
            "total_spent":   round(user["total_spent"], 2),
            "txn_count":     user["txn_count"],
            "last_active_at": user["last_active_at"],
        }


@router.get("/ranking", response_model=RankingResponse)
def get_ranking():

    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, username, balance, total_earned,
                   total_spent, txn_count, last_active_at
            FROM users
        """).fetchall()

        users = [dict(row) for row in rows]
        ranked = compute_rankings(users)

        for u in ranked:
            u["user_id"] = u.pop("id")

        return {
            "users": ranked,
            "scoring_formula": (
                "score = (normalized_total_earned × 0.5) + "
                "(normalized_txn_count × 0.3) + "
                "(recency_score × 0.2) | "
                "recency_score = 1 / (1 + days_since_last_active)"
            )
        }