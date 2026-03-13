import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getUserById(userId: string) {
  const client = await pool.connect();
  try {
    // Safe: parameterized query with placeholder
    const res = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
    return res.rows[0];
  } finally {
    client.release();
  }
}

export async function searchUsers(name: string, limit: number) {
  const res = await pool.query(
    "SELECT * FROM users WHERE name ILIKE $1 LIMIT $2",
    [`%${name}%`, limit]
  );
  return res.rows;
}
