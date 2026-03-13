import { Database } from "../../../src/db";

interface UserService {
  db: Database;
}

export class UserRepository implements UserService {
  constructor(public db: Database) {}

  async findUserById(userId: string) {
    // Vulnerable: string concatenation in SQL query
    const result = await this.db.query("SELECT * FROM users WHERE id=" + userId);
    return result.rows[0];
  }

  async searchUsers(name: string) {
    const query = "SELECT * FROM users WHERE name='" + name + "'";
    const result = await this.db.query(query);
    return result.rows;
  }
}
