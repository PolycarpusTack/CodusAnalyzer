import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface Config {
  theme: string;
  language: string;
}

export function loadAppConfig(configDir: string): Config {
  const configPath = join(configDir, "app.json");

  if (!existsSync(configPath)) {
    const defaults: Config = { theme: "light", language: "en" };
    writeFileSync(configPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  // Blocking: synchronous file read on potentially large file
  const data = readFileSync(configPath, "utf-8");
  return JSON.parse(data);
}

export function getAllTemplates(templateDir: string): string[] {
  const index = readFileSync(join(templateDir, "index.json"), "utf-8");
  return JSON.parse(index);
}
