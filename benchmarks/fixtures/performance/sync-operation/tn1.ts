import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";

interface Config {
  theme: string;
  language: string;
}

export async function loadAppConfig(configDir: string): Promise<Config> {
  const configPath = join(configDir, "app.json");

  try {
    await access(configPath);
  } catch {
    const defaults: Config = { theme: "light", language: "en" };
    await writeFile(configPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }

  // Non-blocking: async file read
  const data = await readFile(configPath, "utf-8");
  return JSON.parse(data);
}

export async function getAllTemplates(templateDir: string): Promise<string[]> {
  const index = await readFile(join(templateDir, "index.json"), "utf-8");
  return JSON.parse(index);
}
