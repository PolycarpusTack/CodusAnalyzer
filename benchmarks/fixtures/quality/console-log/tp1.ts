import { UserService } from "../../../src/services";

export async function handleUserRegistration(email: string, name: string) {
  const service = new UserService();

  console.log("Starting registration for:", email);

  try {
    const user = await service.createUser({ email, name });
    console.log("User created successfully:", user.id);
    console.log("debug info", { email, name, userId: user.id });
    return user;
  } catch (error) {
    console.log("Registration failed:", error);
    console.error("Critical failure in registration");
    throw error;
  }
}
