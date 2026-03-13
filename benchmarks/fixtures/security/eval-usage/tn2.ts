import { readFileSync } from "fs";
import { join } from "path";

interface AppConfig {
  port: number;
  host: string;
  features: string[];
}

export function loadConfig(configPath: string): AppConfig {
  const raw = readFileSync(join(process.cwd(), configPath), "utf-8");

  // Safe: JSON.parse instead of eval for parsing data
  const config: AppConfig = JSON.parse(raw);

  if (!config.port || !config.host) {
    throw new Error("Invalid configuration: missing required fields");
  }

  return config;
}

export function parseUserPayload(jsonString: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON payload");
  }
}
