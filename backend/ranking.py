from datetime import datetime, timezone


def compute_recency_score(last_active_at: str) -> float:
    # Smooth decay based on days since last activity
    # Active today → ~1.0
    # 1 day ago   → 0.5
    # 7 days ago  → 0.125
    # 30 days ago → 0.032
    try:
        last_active = datetime.fromisoformat(last_active_at).replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        days_since = max(0, (now - last_active).total_seconds() / 86400)
        return 1.0 / (1.0 + days_since)
    except Exception:
        return 0.5  # neutral fallback if parsing fails


def normalize(values: list[float]) -> list[float]:
    # Min-max normalization → scales all values to [0, 1]
    # We use this instead of z-score because z-score can produce
    # negatives, which break our weighted sum formula
    if not values:
        return []
    min_v, max_v = min(values), max(values)
    if max_v == min_v:
        # All users have the same value → give everyone neutral 0.5
        return [0.5] * len(values)
    return [(v - min_v) / (max_v - min_v) for v in values]


def compute_rankings(users: list[dict]) -> list[dict]:
    if not users:
        return []

    # Step 1 — extract raw values for each factor
    earned_values  = [u["total_earned"] for u in users]
    txn_values     = [u["txn_count"]    for u in users]
    recency_values = [compute_recency_score(u["last_active_at"]) for u in users]

    # Step 2 — normalize each factor independently to [0, 1]
    norm_earned  = normalize(earned_values)
    norm_txn     = normalize(txn_values)
    norm_recency = normalize(recency_values)

    # Step 3 — weighted sum → composite score
    # 50% volume, 30% consistency, 20% recency
    scored_users = []
    for i, user in enumerate(users):
        score = (
            norm_earned[i]  * 0.5 +
            norm_txn[i]     * 0.3 +
            norm_recency[i] * 0.2
        )
        scored_users.append({
            **user,
            "score": round(score, 6),
        })

    # Step 4 — sort descending
    scored_users.sort(key=lambda u: u["score"], reverse=True)

    # Step 5 — assign rank starting from 1
    for rank, user in enumerate(scored_users, start=1):
        user["rank"] = rank

    return scored_users