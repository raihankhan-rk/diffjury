import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrState,
  estimateTokens,
  preparePrState,
  PR_STATE_TOKEN_BUDGET,
} from "./types.ts";

test("leaves an under-budget PR state byte-identical", () => {
  const input = {
    title: "Keep all context",
    body: "A short body with whitespace.  ",
    diff: "diff --git a/src/a.ts b/src/a.ts\n+export const a = 1;\n",
    linkedIssue: "Fixes #42",
  };

  assert.equal(preparePrState(input), buildPrState(input));
});

test("drops lockfile hunks on oversized PRs and stays under budget", () => {
  const sourceDiff = [
    "diff --git a/src/feature.ts b/src/feature.ts",
    "--- a/src/feature.ts",
    "+++ b/src/feature.ts",
    `+${"const value = 1;\n".repeat(3_500)}`,
  ].join("\n");
  const lockfileDiff = [
    "diff --git a/package-lock.json b/package-lock.json",
    "--- a/package-lock.json",
    "+++ b/package-lock.json",
    `+${'"dependency": "1.0.0"\n'.repeat(3_500)}`,
  ].join("\n");
  const input = {
    title: "A synthetic oversized PR",
    body: "Context ".repeat(2_000),
    diff: `${lockfileDiff}\n${sourceDiff}`,
  };

  const state = preparePrState(input);

  assert.ok(estimateTokens(buildPrState(input)) > PR_STATE_TOKEN_BUDGET);
  assert.ok(estimateTokens(state) <= PR_STATE_TOKEN_BUDGET);
  assert.match(state, /diff --git a\/src\/feature\.ts b\/src\/feature\.ts/);
  assert.doesNotMatch(state, /"dependency": "1\.0\.0"/);
});
