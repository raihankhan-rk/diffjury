import { NextResponse } from "next/server";

import {
  parsePrUrl,
  type GithubPerson,
  type GithubPrPayload,
} from "@/lib/github";

export const runtime = "nodejs";

type GithubUser = {
  login?: string;
  avatar_url?: string;
  html_url?: string;
};

type GithubPr = {
  title: string;
  body: string | null;
  user: GithubUser | null;
  html_url: string;
  number: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  state?: string;
  draft?: boolean;
  merged?: boolean;
  created_at?: string;
};

type GithubCommit = {
  author: GithubUser | null;
  committer: GithubUser | null;
  commit?: {
    author?: { name?: string; email?: string };
    committer?: { name?: string; email?: string };
    message?: string;
  };
};

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "DiffJury",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function extractIssueNumbers(body: string): string[] {
  const found = new Set<string>();
  const re =
    /(?:(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+)?(?:https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/|#)(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(`#${m[1]}`);
  }
  return [...found];
}

function personFromUser(user: GithubUser | null | undefined): GithubPerson | null {
  if (!user?.login || isSkippedLogin(user.login)) return null;
  return {
    login: user.login,
    avatarUrl: user.avatar_url ?? `https://github.com/${user.login}.png?size=80`,
    htmlUrl: user.html_url ?? `https://github.com/${user.login}`,
  };
}

const SKIP_LOGINS = new Set([
  "web-flow",
  "ghost",
  "cursor",
  "copilot",
  "copilot[bot]",
  "github-actions",
  "github-actions[bot]",
]);

function isSkippedLogin(login: string): boolean {
  const key = login.trim().toLowerCase();
  if (key.length < 2 || SKIP_LOGINS.has(key) || key.endsWith("[bot]")) return true;
  return /^(claude|chatgpt|gpt-|openai|anthropic|cursor|copilot)\b/.test(key) ||
    key.includes("sonnet");
}

function isBotEmail(email?: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return (
    e.includes("cursor.com") ||
    e.includes("cursoragent") ||
    e.includes("anthropic.com") ||
    e.includes("openai.com") ||
    (e.endsWith("@noreply.github.com") && /web-flow|copilot|github-actions/.test(e))
  );
}

function personFromCoAuthor(name: string, email?: string): GithubPerson | null {
  if (isBotEmail(email)) return null;
  const trimmedName = name.trim();
  const trimmedEmail = email?.trim() ?? "";
  const noreply = /^(?:\d+\+)?([A-Za-z0-9-]+)@users\.noreply\.github\.com$/i.exec(
    trimmedEmail,
  );
  if (noreply) {
    const login = noreply[1];
    if (isSkippedLogin(login)) return null;
    return {
      login,
      avatarUrl: `https://github.com/${login}.png?size=80`,
      htmlUrl: `https://github.com/${login}`,
    };
  }
  if (isSkippedLogin(trimmedName) || trimmedName.length < 2) return null;
  return {
    login: trimmedName,
    avatarUrl: null,
    htmlUrl: null,
  };
}

function extractCoAuthors(message: string | undefined): GithubPerson[] {
  if (!message) return [];
  const people: GithubPerson[] = [];
  // Official trailer is `Co-authored-by: Name <email>`. Require the email so a
  // non-greedy name match cannot collapse "Cursor" into the stray letter "C".
  const re = /Co-authored-by:\s*([^<\n]+?)\s*<([^>\n]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const person = personFromCoAuthor(m[1], m[2]);
    if (person) people.push(person);
  }
  return people;
}

function addPerson(map: Map<string, GithubPerson>, person: GithubPerson | null) {
  if (!person || isSkippedLogin(person.login)) return;
  const key = person.login.toLowerCase();
  const existing = map.get(key);
  if (!existing) {
    map.set(key, person);
    return;
  }
  if (!existing.avatarUrl && person.avatarUrl) {
    map.set(key, person);
  }
}

async function readGithubError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message || res.statusText;
  } catch {
    return res.statusText || "GitHub request failed";
  }
}

function mapGithubStatus(status: number, message: string): { status: number; error: string } {
  if (status === 404) {
    return {
      status: 404,
      error: "PR not found. It may be private, deleted, or the URL is wrong.",
    };
  }
  if (status === 403 || status === 429) {
    const rateLimited =
      /rate limit/i.test(message) || status === 429 || /API rate limit/i.test(message);
    if (rateLimited) {
      return {
        status: 429,
        error:
          "GitHub API rate limit exceeded. Try again later, or set GITHUB_TOKEN on the server for higher limits.",
      };
    }
    return {
      status: 403,
      error: "GitHub denied access to this PR. It may be private.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 502,
    error: message || `GitHub request failed (${status})`,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url =
    typeof body === "object" && body !== null && "url" in body
      ? String((body as { url: unknown }).url ?? "")
      : "";

  const parsed = parsePrUrl(url);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid PR URL. Use a public GitHub link like https://github.com/owner/repo/pull/123",
      },
      { status: 400 },
    );
  }

  const { owner, repo, number } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
  const headers = githubHeaders();

  try {
    const [prRes, diffRes, commitsRes] = await Promise.all([
      fetch(base, { headers, next: { revalidate: 0 } }),
      fetch(base, {
        headers: { ...headers, Accept: "application/vnd.github.v3.diff" },
        next: { revalidate: 0 },
      }),
      fetch(`${base}/commits?per_page=100`, { headers, next: { revalidate: 0 } }),
    ]);

    if (!prRes.ok) {
      const message = await readGithubError(prRes);
      const mapped = mapGithubStatus(prRes.status, message);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    if (!diffRes.ok) {
      const message = await readGithubError(diffRes);
      const mapped = mapGithubStatus(diffRes.status, message);
      return NextResponse.json(
        { error: mapped.error || "Failed to fetch PR diff" },
        { status: mapped.status },
      );
    }

    const pr = (await prRes.json()) as GithubPr;
    const diff = await diffRes.text();

    const people = new Map<string, GithubPerson>();
    const author = personFromUser(pr.user);
    addPerson(people, author);

    if (commitsRes.ok) {
      const commits = (await commitsRes.json()) as GithubCommit[];
      for (const c of commits) {
        addPerson(people, personFromUser(c.author));
        if (c.committer?.login && c.committer.login !== "web-flow") {
          addPerson(people, personFromUser(c.committer));
        }
        for (const co of extractCoAuthors(c.commit?.message)) {
          addPerson(people, co);
        }
      }
    }

    const prBody = pr.body ?? "";
    const payload: GithubPrPayload = {
      title: pr.title,
      body: prBody,
      diff,
      author,
      contributors: [...people.values()],
      linkedIssues: extractIssueNumbers(prBody),
      htmlUrl: pr.html_url,
      number: pr.number,
      owner,
      repo,
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changedFiles: pr.changed_files ?? null,
      state: pr.state ?? null,
      draft: Boolean(pr.draft),
      merged: Boolean(pr.merged),
      createdAt: pr.created_at ?? null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch PR";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Also support GET ?url= for quick testing */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";
  const synthetic = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return POST(synthetic);
}
