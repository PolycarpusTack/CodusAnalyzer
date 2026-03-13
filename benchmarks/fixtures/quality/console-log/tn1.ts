import { UserService } from "../../../src/services";
import { logger } from "../../../src/logger";

export async function handleUserRegistration(email: string, name: string) {
  const service = new UserService();

  logger.info("Starting registration", { email });

  try {
    const user = await service.createUser({ email, name });
    logger.info("User created successfully", { userId: user.id });
    return user;
  } catch (error) {
    logger.error("Registration failed", { error, email });
    throw error;
  }
}
