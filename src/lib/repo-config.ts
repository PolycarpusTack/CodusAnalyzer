// ---------------------------------------------------------------------------
// Repo config — fetch and parse .codereview.yml from a repository
// ---------------------------------------------------------------------------

import { githubFetch } from './github-app';
import { logger } from './logger';

export interface RepoConfig {
  enabled?: boolean;
  preset?: string;
  auto_review?: boolean;
  min_severity?: string;
  max_comments?: number;
  ignore_paths?: string[];
  ignore_rules?: string[];
  custom_rules?: Array<{
    id: string;
    pattern: string;
    severity: string;
    message: string;
  }>;
}

/**
 * Fetch and parse .codereview.yml from a repository.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export async function fetchRepoConfig(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoConfig | null> {
  try {
    const res = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.codereview.yml`,
      {
        headers: { Authorization: `token ${token}` },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await res.json();
    if (data.encoding !== 'base64' || !data.content) return null;

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return parseYamlConfig(content);
  } catch (error) {
    logger.warn('Failed to fetch repo config', { owner, repo, error: String(error) });
    return null;
  }
}

/**
 * Simple YAML-like parser for .codereview.yml.
 * Handles the subset of YAML we need without requiring a full YAML parser.
 */
function parseYamlConfig(content: string): RepoConfig {
  const config: RepoConfig = {};
  const lines = content.split('\n');
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Array item
    if (trimmed.startsWith('- ') && currentArrayKey) {
      currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Flush previous array
    if (currentArrayKey && currentArray.length > 0) {
      (config as Record<string, unknown>)[currentArrayKey] = currentArray;
      currentArray = [];
      currentArrayKey = null;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      const cleanValue = value.trim().replace(/^["']|["']$/g, '');

      if (cleanValue === 'true') (config as Record<string, unknown>)[key] = true;
      else if (cleanValue === 'false') (config as Record<string, unknown>)[key] = false;
      else if (/^\d+$/.test(cleanValue)) (config as Record<string, unknown>)[key] = parseInt(cleanValue, 10);
      else (config as Record<string, unknown>)[key] = cleanValue;
      continue;
    }

    // Array start (key with no value)
    const arrayMatch = trimmed.match(/^(\w+)\s*:\s*$/);
    if (arrayMatch) {
      currentArrayKey = arrayMatch[1];
      currentArray = [];
    }
  }

  // Flush final array
  if (currentArrayKey && currentArray.length > 0) {
    (config as Record<string, unknown>)[currentArrayKey] = currentArray;
  }

  return config;
}
