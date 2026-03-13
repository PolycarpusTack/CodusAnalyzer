import { readConfig, sendNotification } from "../../../src/utils";

export function loadSettings(path: string): Record<string, string> {
  let settings: Record<string, string> = {};

  try {
    settings = readConfig(path);
  } catch (e) {
    // Empty catch: silently swallows all errors
  }

  return settings;
}

export async function notifyUser(userId: string, message: string) {
  try {
    await sendNotification(userId, message);
  } catch (error) {}
}

export function parseNumber(input: string): number {
  try {
    return parseInt(input, 10);
  } catch (e) {
    // silently ignore
  }
  return 0;
}
