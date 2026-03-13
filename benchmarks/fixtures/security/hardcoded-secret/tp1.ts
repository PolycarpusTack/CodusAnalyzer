import { createConnection } from "mysql2";

const DB_HOST = "localhost";
const DB_PORT = 3306;
const DB_USER = "admin";
const password = "mypassword123";

export function connectToDatabase() {
  const connection = createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: password,
    database: "app_production",
  });

  connection.connect((err) => {
    if (err) throw err;
    console.log("Connected to database");
  });

  return connection;
}
