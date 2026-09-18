export type ReviewInput = {
  title: string;
  body: string;
  diff: string;
  ciLog?: string;
  linkedIssue?: string;
};

export type SerializedAnswer =
  | {
      type: "noul";
      noul: number;
    }
  | {
      type: "choice";
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    }
  | {
      type: "score";
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
      legend: Record<string, string>;
    };

export type ReviewAnswers = {
  risk: SerializedAnswer;
  review_depth: SerializedAnswer;
  needs_design: SerializedAnswer;
  needs_security: SerializedAnswer;
  merge_blocker: SerializedAnswer;
  missing_tests: SerializedAnswer;
  docs_debt: SerializedAnswer;
  blast_radius: SerializedAnswer;
  verdict: SerializedAnswer;
};

export type ReviewResponse = {
  answers: ReviewAnswers;
  model: string;
  latency_ms: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

// Jev limits state + longest question to ~32k tokens (and all questions to ~64k).
// Keep state below 28k estimated tokens so the fixed review questions have headroom.
export const PR_STATE_TOKEN_BUDGET = 28_000;
const ESTIMATED_CHARS_PER_TOKEN = 3.5;
const PR_BODY_CHAR_LIMIT = 6_000;
const OPTIONAL_CONTEXT_CHAR_LIMIT = 6_000;
const BODY_TRUNCATED_MARKER = "\n…[body truncated]";
const CONTEXT_TRUNCATED_MARKER = "\n…[context truncated]";
const DIFF_TRUNCATED_MARKER = "\n…[diff truncated for token budget]";
const TRIM_SUMMARY_RESERVE = 180;

type DiffSection = {
  content: string;
  path: string;
  deprioritized: boolean;
};

export function estimateTokens(value: string): number {
  return Math.ceil(value.length / ESTIMATED_CHARS_PER_TOKEN);
}

export function buildPrState(input: ReviewInput): string {
  const sections = [
    `PR TITLE:\n${input.title.trim()}`,
    `PR BODY:\n${input.body.trim() || "(empty)"}`,
    `DIFF:\n${input.diff.trim()}`,
  ];

  if (input.ciLog?.trim()) {
    sections.push(`CI LOG:\n${input.ciLog.trim()}`);
  }

  if (input.linkedIssue?.trim()) {
    sections.push(`LINKED ISSUE:\n${input.linkedIssue.trim()}`);
  }

  return sections.join("\n\n");
}

function truncateWithMarker(value: string, limit: number, marker: string): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - marker.length)).trimEnd()}${marker}`;
}

function isDeprioritizedPath(path: string): boolean {
  const normalized = path.toLowerCase();
  const basename = normalized.split("/").pop() ?? normalized;

  return (
    /(^|[-.])(lock|lockfile)(\.|$)/.test(basename) ||
    [
      "package-lock.json",
      "npm-shrinkwrap.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lock",
      "bun.lockb",
      "cargo.lock",
      "poetry.lock",
      "pdm.lock",
      "pipfile.lock",
      "composer.lock",
      "gemfile.lock",
      "go.sum",
    ].includes(basename) ||
    /\.min\.[^.]+$/.test(basename) ||
    basename.endsWith(".map") ||
    /(^|\/)(vendor|vendored|generated|dist|build|coverage)\//.test(normalized) ||
    /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|mov|wasm)$/.test(
      basename,
    )
  );
}

function splitDiff(diff: string): { preamble: string; sections: DiffSection[] } {
  const starts = [...diff.matchAll(/^diff --git .+$/gm)];
  if (starts.length === 0) {
    return { preamble: "", sections: [] };
  }

  const preamble = diff.slice(0, starts[0].index).trim();
  const sections = starts.map((match, index) => {
    const start = match.index;
    const end = starts[index + 1]?.index ?? diff.length;
    const content = diff.slice(start, end).trimEnd();
    const header = match[0];
    const pathMatch = header.match(/^diff --git (?:a\/.+|".+") (?:b\/(.+)|"b\/(.+)")$/);
    const path = (pathMatch?.[1] ?? pathMatch?.[2] ?? header.replace(/^diff --git /, "")).replace(
      /\\"/g,
      '"',
    );

    return {
      content,
      path,
      deprioritized: isDeprioritizedPath(path),
    };
  });

  return { preamble, sections };
}

function omissionNote(section: DiffSection, reason: "token_budget" | "deprioritized"): string {
  return `...[file omitted: ${section.path}; ${section.content.length} chars; reason=${reason}]`;
}

function buildTrimSummary(
  included: number,
  omitted: number,
  unlisted: number,
  estimatedTokens: number,
): string {
  return [
    "[DIFFJURY_TRIM_SUMMARY",
    `included_files=${included}`,
    `omitted_files=${omitted}`,
    `unlisted_omissions=${unlisted}`,
    `estimated_tokens=${estimatedTokens}]`,
  ].join(" ");
}

/**
 * Returns the original serialized state unchanged when it fits. Oversized states
 * are reduced locally, favoring complete source-file diffs over generated files.
 */
export function preparePrState(input: ReviewInput): string {
  const fullState = buildPrState(input);
  if (estimateTokens(fullState) <= PR_STATE_TOKEN_BUDGET) {
    return fullState;
  }

  const body = truncateWithMarker(
    input.body.trim() || "(empty)",
    PR_BODY_CHAR_LIMIT,
    BODY_TRUNCATED_MARKER,
  );
  const fixedSections = [`PR TITLE:\n${input.title.trim()}`, `PR BODY:\n${body}`];

  if (input.ciLog?.trim()) {
    fixedSections.push(
      `CI LOG:\n${truncateWithMarker(
        input.ciLog.trim(),
        OPTIONAL_CONTEXT_CHAR_LIMIT,
        CONTEXT_TRUNCATED_MARKER,
      )}`,
    );
  }

  if (input.linkedIssue?.trim()) {
    fixedSections.push(
      `LINKED ISSUE:\n${truncateWithMarker(
        input.linkedIssue.trim(),
        OPTIONAL_CONTEXT_CHAR_LIMIT,
        CONTEXT_TRUNCATED_MARKER,
      )}`,
    );
  }

  const maxChars = Math.floor(PR_STATE_TOKEN_BUDGET * ESTIMATED_CHARS_PER_TOKEN);
  const { preamble, sections } = splitDiff(input.diff.trim());

  if (sections.length === 0) {
    const prefix = `${fixedSections.join("\n\n")}\n\nDIFF:\n`;
    const available = Math.max(
      0,
      maxChars - prefix.length - DIFF_TRUNCATED_MARKER.length - TRIM_SUMMARY_RESERVE,
    );
    const trimmedDiff = `${input.diff.trim().slice(0, available).trimEnd()}${DIFF_TRUNCATED_MARKER}`;
    const withoutSummary = `${prefix}${trimmedDiff}\n\n`;
    const summary = buildTrimSummary(0, 0, 0, estimateTokens(withoutSummary));
    return `${withoutSummary}${summary}`;
  }

  const statePrefix = `${fixedSections.join("\n\n")}\n\nDIFF:\n`;
  const diffParts = preamble ? [preamble] : [];
  const prioritized = [...sections].sort(
    (a, b) =>
      Number(a.deprioritized) - Number(b.deprioritized) ||
      a.content.length - b.content.length,
  );
  const included = new Set<DiffSection>();

  for (const section of prioritized) {
    const candidateLength =
      statePrefix.length +
      [...diffParts, section.content].join("\n\n").length +
      TRIM_SUMMARY_RESERVE;
    if (candidateLength <= maxChars) {
      diffParts.push(section.content);
      included.add(section);
    }
  }

  let unlisted = 0;
  for (const section of sections) {
    if (included.has(section)) {
      continue;
    }

    const note = omissionNote(
      section,
      section.deprioritized ? "deprioritized" : "token_budget",
    );
    const candidateLength =
      statePrefix.length +
      [...diffParts, note].join("\n\n").length +
      TRIM_SUMMARY_RESERVE;
    if (candidateLength <= maxChars) {
      diffParts.push(note);
    } else {
      unlisted += 1;
    }
  }

  const withoutSummary = `${statePrefix}${diffParts.join("\n\n")}\n\n`;
  const omitted = sections.length - included.size;
  let summary = buildTrimSummary(
    included.size,
    omitted,
    unlisted,
    estimateTokens(withoutSummary),
  );
  let result = `${withoutSummary}${summary}`;
  summary = buildTrimSummary(included.size, omitted, unlisted, estimateTokens(result));
  result = `${withoutSummary}${summary}`;

  return result;
}
