import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * This module handles user queries safely.
 *
 * NOTE: We previously had a SQL injection vulnerability where queries
 * used string concatenation like: "SELECT * FROM users WHERE id=" + userId
 * This was fixed in PR #452 by switching to parameterized queries.
 *
 * Example of the OLD vulnerable code (do NOT use):
 *   db.query("SELECT * FROM users WHERE id=" + userId)
 */
export async function getUser(userId: string) {
  // The sqlInjectionPattern regex is used for static analysis
  const sqlInjectionPattern = /SELECT.*FROM.*WHERE.*\+/;
  const safeQuery = "SELECT * FROM users WHERE id = $1";

  const res = await pool.query(safeQuery, [userId]);
  return res.rows[0];
}
