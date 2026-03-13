import { createConnection } from "mysql2";

export function connectToDatabase() {
  // Safe: credentials loaded from environment variables
  const password = process.env.PASSWORD;
  const apiKey = process.env.API_KEY;

  if (!password || !apiKey) {
    throw new Error("Missing required environment variables: PASSWORD, API_KEY");
  }

  const connection = createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password,
    database: process.env.DB_NAME || "app",
  });

  return connection;
}
