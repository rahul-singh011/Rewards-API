"""
models.py — Request and response schemas

Why Pydantic?
FastAPI runs every incoming request body through these models automatically.
Wrong type, missing field, value out of range → FastAPI returns 422 with a
detailed error before our code even runs. Zero manual validation needed.

Response models ensure we never leak internal DB fields to the client.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal


# ── REQUEST ──────────────────────────────────────────────────────────────────

class TransactionRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    amount: float = Field(..., gt=0, description="Must be positive")
    type: Literal["earn", "spend"]
    idempotency_key: str = Field(..., min_length=1, max_length=128)

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        # Prevent floating point drift: 10.9999999 becomes 11.0
        return round(v, 2)

    @field_validator("user_id", "idempotency_key")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class TransactionResponse(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    type: str
    new_balance: float
    message: str


class SummaryResponse(BaseModel):
    user_id: str
    username: str
    balance: float
    total_earned: float
    total_spent: float
    txn_count: int
    last_active_at: str


class RankedUser(BaseModel):
    rank: int
    user_id: str
    username: str
    score: float
    balance: float
    total_earned: float
    txn_count: int
    last_active_at: str


class RankingResponse(BaseModel):
    users: list[RankedUser]
    scoring_formula: str    