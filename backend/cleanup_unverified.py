"""
Utility script — delete all unverified users from the local SQLite database.
Run from the backend directory:
    python cleanup_unverified.py
"""

import sqlite3
from pathlib import Path

# Resolve the DB path relative to this script (same as the app)
DB_PATH = Path(__file__).resolve().parent.parent / "repolens.db"

if not DB_PATH.exists():
    print(f"Database not found at {DB_PATH}")
    raise SystemExit(1)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Show what we're about to delete
c.execute("SELECT id, email, created_at FROM users WHERE is_verified = 0")
rows = c.fetchall()

if not rows:
    print("No unverified users found — nothing to delete.")
    conn.close()
    raise SystemExit(0)

print(f"Found {len(rows)} unverified user(s):")
for row in rows:
    print(f"  id={row[0]}  email={row[1]}  created_at={row[2]}")

confirm = input("\nDelete all of the above? [y/N] ").strip().lower()
if confirm != "y":
    print("Aborted.")
    conn.close()
    raise SystemExit(0)

c.execute("DELETE FROM users WHERE is_verified = 0")
conn.commit()
print(f"Deleted {c.rowcount} unverified user(s) successfully.")
conn.close()
