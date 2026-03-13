import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getUserOrders(userId: string) {
  const client = await pool.connect();
  try {
    // Vulnerable: template literal interpolation in SQL
    const res = await client.query(`SELECT * FROM users WHERE id=${userId}`);
    const user = res.rows[0];

    const orders = await client.query(
      `SELECT * FROM orders WHERE user_id=${user.id} AND status='active'`
    );
    return { user, orders: orders.rows };
  } finally {
    client.release();
  }
}
