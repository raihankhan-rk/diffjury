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
    ciLog: "tests pass",
    linkedIssue: "Fixes #42",
  };

  assert.equal(preparePrState(input), buildPrState(input));
});

test("prioritizes source files and marks omitted lockfiles", () => {
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
  assert.match(
    state,
    /\[file omitted: package-lock\.json; \d+ chars; reason=deprioritized\]/,
  );
  assert.match(state, /…\[body truncated\]/);
  assert.match(
    state,
    /\[DIFFJURY_TRIM_SUMMARY included_files=1 omitted_files=1 unlisted_omissions=0 estimated_tokens=\d+\]/,
  );
});
