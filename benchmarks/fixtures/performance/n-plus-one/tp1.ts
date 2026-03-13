import { Database, User, Order } from "../../../src/types";

interface UserWithOrders extends User {
  orders: Order[];
}

export async function getUsersWithOrders(db: Database): Promise<UserWithOrders[]> {
  const users = await db.getUsers();
  const result: UserWithOrders[] = [];

  // N+1 problem: one query per user inside a loop
  for (const user of users) {
    const orders = await db.getOrders(user.id);
    result.push({ ...user, orders });
  }

  return result;
}

export async function enrichUserProfiles(db: Database, users: User[]) {
  return Promise.all(
    users.map(async (user) => {
      const profile = await db.getProfile(user.id);
      return { ...user, profile };
    })
  );
}
