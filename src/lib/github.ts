export const PR_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:[?#].*)?$/i;

export type ParsedPrUrl = {
  owner: string;
  repo: string;
  number: number;
};

export function parsePrUrl(raw: string): ParsedPrUrl | null {
  const trimmed = raw.trim();
  const match = trimmed.match(PR_URL_RE);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ""),
    number: Number(match[3]),
  };
}

export type GithubPerson = {
  login: string;
  avatarUrl: string | null;
  htmlUrl: string | null;
};

export type GithubPrPayload = {
  title: string;
  body: string;
  diff: string;
  author: GithubPerson | null;
  contributors: GithubPerson[];
  linkedIssues: string[];
  htmlUrl: string;
  number: number;
  owner: string;
  repo: string;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  state: string | null;
  draft: boolean;
  merged: boolean;
  createdAt: string | null;
};

export function issueUrl(owner: string, repo: string, label: string): string {
  const n = label.replace(/^#/, "");
  return `https://github.com/${owner}/${repo}/issues/${n}`;
}

export function githubProfileUrl(person: GithubPerson): string | null {
  return person.htmlUrl ?? (looksLikeGithubLogin(person.login)
    ? `https://github.com/${person.login}`
    : null);
}

export function looksLikeGithubLogin(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value);
}
