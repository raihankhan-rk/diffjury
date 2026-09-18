import "server-only";

import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

import { preparePrState, type ReviewInput, type ReviewResponse } from "./types";

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

export async function runReview(input: ReviewInput): Promise<ReviewResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("TYPESAFE_API_KEY is not configured");
  }

  const client = new TypeSafeClient({ apiKey });
  const started = Date.now();
  const result = await client.systemOne({
    model: "jev-latest",
    state: preparePrState(input),
    questions: REVIEW_QUESTIONS,
  });

  return {
    answers: result.answers as ReviewResponse["answers"],
    model: result.model,
    latency_ms: Date.now() - started,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    },
  };
}
