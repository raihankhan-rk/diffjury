import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PR_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:[?#].*)?$/i;

type GithubUser = {
  login?: string;
};

type GithubPr = {
  title: string;
  body: string | null;
  user: GithubUser | null;
  html_url: string;
  number: number;
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

function parsePrUrl(raw: string): { owner: string; repo: string; number: number } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(PR_URL_RE);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ""),
    number: Number(match[3]),
  };
}

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

function extractCoAuthors(message: string | undefined): string[] {
  if (!message) return [];
  const names: string[] = [];
  const re = /Co-authored-by:\s*([^<\n]+?)(?:\s*<[^>]*>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const name = m[1].trim();
    if (name) names.push(name);
  }
  return names;
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

    const contributors = new Set<string>();
    if (pr.user?.login) contributors.add(pr.user.login);

    if (commitsRes.ok) {
      const commits = (await commitsRes.json()) as GithubCommit[];
      for (const c of commits) {
        if (c.author?.login) contributors.add(c.author.login);
        if (c.committer?.login && c.committer.login !== "web-flow") {
          contributors.add(c.committer.login);
        }
        for (const co of extractCoAuthors(c.commit?.message)) {
          contributors.add(co);
        }
      }
    }

    const prBody = pr.body ?? "";
    const linkedIssues = extractIssueNumbers(prBody);

    return NextResponse.json({
      title: pr.title,
      body: prBody,
      diff,
      author: pr.user?.login ?? null,
      contributors: [...contributors],
      linkedIssues,
      htmlUrl: pr.html_url,
      number: pr.number,
      owner,
      repo,
    });
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
