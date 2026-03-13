import { readConfig, sendNotification } from "../../../src/utils";
import { logger } from "../../../src/logger";

export function loadSettings(path: string): Record<string, string> {
  let settings: Record<string, string> = {};

  try {
    settings = readConfig(path);
  } catch (e) {
    logger.error("Failed to load settings", { path, error: e });
    settings = getDefaultSettings();
  }

  return settings;
}

export async function notifyUser(userId: string, message: string) {
  try {
    await sendNotification(userId, message);
  } catch (error) {
    logger.warn("Notification delivery failed", { userId, error });
  }
}

function getDefaultSettings(): Record<string, string> {
  return { theme: "light", locale: "en-US" };
}
