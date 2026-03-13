import { Database, User, Order } from "../../../src/types";

interface UserWithOrders extends User {
  orders: Order[];
}

export async function getUsersWithOrders(db: Database): Promise<UserWithOrders[]> {
  const users = await db.getUsers();
  const userIds = users.map((u) => u.id);

  // Efficient: single batch query for all orders
  const orders = await db.getOrdersForUsers(userIds);

  const ordersByUser = new Map<string, Order[]>();
  for (const order of orders) {
    const existing = ordersByUser.get(order.userId) || [];
    existing.push(order);
    ordersByUser.set(order.userId, existing);
  }

  return users.map((user) => ({
    ...user,
    orders: ordersByUser.get(user.id) || [],
  }));
}
