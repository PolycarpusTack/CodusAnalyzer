export interface GitHubFileResult {
  content: string;
  fileName: string;
  language: string | null;
}

const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;

export function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3], path: match[4] };
}

export function isGitHubUrl(url: string): boolean {
  return GITHUB_URL_PATTERN.test(url.trim());
}
