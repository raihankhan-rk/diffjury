export type ReviewInput = {
  title: string;
  body: string;
  diff: string;
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
    }
  | {
      type: "score";
      score: number;
      confidence: number;
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
export const PR_STATE_TOKEN_BUDGET = 28_000;
const ESTIMATED_CHARS_PER_TOKEN = 3.5;

export function estimateTokens(value: string): number {
  return Math.ceil(value.length / ESTIMATED_CHARS_PER_TOKEN);
}

export function buildPrState(input: ReviewInput): string {
  const sections = [
    `PR TITLE:\n${input.title.trim()}`,
    `PR BODY:\n${input.body.trim() || "(empty)"}`,
    `DIFF:\n${input.diff.trim()}`,
  ];

  if (input.linkedIssue?.trim()) {
    sections.push(`LINKED ISSUE:\n${input.linkedIssue.trim()}`);
  }

  return sections.join("\n\n");
}

function dropLockHunks(diff: string): string {
  return diff
    .split(/(?=^diff --git )/m)
    .filter((hunk) => {
      const header = hunk.split("\n", 1)[0] ?? "";
      // ponytail: header substring; tighten if a source path named *lock* gets dropped
      return !/package-lock|lockfile|\.lockb?(\s|$)|go\.sum/i.test(header);
    })
    .join("")
    .trim();
}

export function preparePrState(input: ReviewInput): string {
  const fullState = buildPrState(input);
  if (estimateTokens(fullState) <= PR_STATE_TOKEN_BUDGET) {
    return fullState;
  }

  const withoutLocks = buildPrState({ ...input, diff: dropLockHunks(input.diff) });
  if (estimateTokens(withoutLocks) <= PR_STATE_TOKEN_BUDGET) {
    return withoutLocks;
  }

  return withoutLocks.slice(0, Math.floor(PR_STATE_TOKEN_BUDGET * ESTIMATED_CHARS_PER_TOKEN));
}
