import "server-only";

import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

import { buildPrState, type ReviewInput, type ReviewResponse, type SerializedAnswer } from "./types";

const REVIEW_QUESTIONS = {
  risk: score("Overall merge risk for this pull request", [
    "Low — safe, narrow, well-tested change",
    "Moderate — some uncertainty or medium surface area",
    "High — risky patterns, large blast radius, or weak coverage",
    "Critical — likely to break production or security posture",
  ]),
  review_depth: choice("How deep should a human reviewer go on this PR?", {
    skim: "Quick glance is enough; change is small and obvious",
    standard: "Normal careful review of logic and tests",
    deep: "Needs thorough review of architecture, edge cases, and side effects",
  }),
  needs_design: noul(
    "Does this PR need a design or architecture discussion before merge?",
  ),
  needs_security: noul(
    "Does this PR need dedicated security review before merge?",
  ),
  merge_blocker: noul(
    "Should merge be blocked until issues in this PR are fixed?",
  ),
  missing_tests: score("How severe is the missing or weak test coverage?", [
    "Adequate tests for the change",
    "Some gaps, but core paths covered",
    "Important paths lack tests",
    "Critical behavior is untested",
  ]),
  docs_debt: score("How much documentation debt does this PR introduce or leave?", [
    "Docs are sufficient",
    "Minor docs gaps",
    "Notable missing docs or comments",
    "Serious docs debt that will confuse maintainers",
  ]),
  blast_radius: score("How wide could a bug in this change spread?", [
    "Isolated to a small local path",
    "Affects one feature area",
    "Could impact multiple modules or users",
    "Could cascade across the system or infra",
  ]),
  verdict: choice("Final DiffJury verdict for this pull request", {
    approve_with_nits: "Safe to merge; nits can land follow-up",
    request_changes: "Needs fixes before merge",
    block: "Do not merge until major issues are resolved",
  }),
} as const;

function serializeAnswer(answer: unknown): SerializedAnswer {
  const a = answer as {
    type: string;
    noul?: number;
    choice?: string;
    confidence?: number;
    score?: number;
    probabilities?: Record<string, number>;
    legend?: Record<string | number, unknown>;
  };

  if (a.type === "noul") {
    return { type: "noul", noul: a.noul ?? 0 };
  }

  if (a.type === "choice") {
    return {
      type: "choice",
      choice: String(a.choice ?? ""),
      confidence: a.confidence ?? 0,
      probabilities: Object.fromEntries(
        Object.entries(a.probabilities ?? {}).map(([k, v]) => [k, Number(v)]),
      ),
    };
  }

  const legend: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.legend ?? {})) {
    legend[String(k)] = typeof v === "string" ? v : JSON.stringify(v);
  }

  return {
    type: "score",
    score: a.score ?? 0,
    confidence: a.confidence ?? 0,
    probabilities: Object.fromEntries(
      Object.entries(a.probabilities ?? {}).map(([k, v]) => [String(k), Number(v)]),
    ),
    legend,
  };
}

export async function runReview(input: ReviewInput): Promise<ReviewResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const client = new TypeSafeClient({
    apiKey,
    defaultModel: "jev-latest",
  });

  const started = Date.now();
  const result = await client.systemOne({
    model: "jev-latest",
    state: buildPrState(input),
    questions: REVIEW_QUESTIONS,
  });
  const latency_ms = Date.now() - started;

  const answers = {
    risk: serializeAnswer(result.answers.risk),
    review_depth: serializeAnswer(result.answers.review_depth),
    needs_design: serializeAnswer(result.answers.needs_design),
    needs_security: serializeAnswer(result.answers.needs_security),
    merge_blocker: serializeAnswer(result.answers.merge_blocker),
    missing_tests: serializeAnswer(result.answers.missing_tests),
    docs_debt: serializeAnswer(result.answers.docs_debt),
    blast_radius: serializeAnswer(result.answers.blast_radius),
    verdict: serializeAnswer(result.answers.verdict),
  };

  return {
    answers,
    model: result.model,
    latency_ms,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    },
  };
}
