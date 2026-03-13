export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  patch: string;
  rawUrl: string;
}

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
  title: string;
  files: PRFile[];
}

const PR_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.trim().match(PR_URL_PATTERN);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string
): Promise<PRInfo> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CodeAnalyzer',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Fetch PR metadata
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers }
  );

  if (!prRes.ok) {
    if (prRes.status === 404) {
      throw new Error('Pull request not found. Make sure the repository is public or provide a valid token.');
    }
    if (prRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Provide a GitHub token to increase limits.');
    }
    throw new Error(`Failed to fetch pull request (${prRes.status})`);
  }

  const prData = await prRes.json();
  const title: string = prData.title || `PR #${prNumber}`;

  // Fetch PR files with pagination
  const allFiles: PRFile[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const filesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
      { headers }
    );

    if (!filesRes.ok) {
      throw new Error(`Failed to fetch PR files (${filesRes.status})`);
    }

    const filesData = await filesRes.json();

    if (!Array.isArray(filesData) || filesData.length === 0) {
      break;
    }

    for (const file of filesData) {
      const status = normalizeStatus(file.status);
      allFiles.push({
        filename: file.filename,
        status,
        patch: file.patch || '',
        rawUrl: file.raw_url || '',
      });
    }

    // Check if there are more pages
    if (filesData.length < perPage) {
      break;
    }

    page++;
  }

  return {
    owner,
    repo,
    number: prNumber,
    title,
    files: allFiles,
  };
}

function normalizeStatus(status: string): 'added' | 'modified' | 'removed' {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'removed';
    case 'modified':
    case 'changed':
    case 'renamed':
    case 'copied':
    default:
      return 'modified';
  }
}
