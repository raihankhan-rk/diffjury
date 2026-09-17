import type { ReviewAnswers, SerializedAnswer } from "@/lib/types";

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function scoreToPct(answer: SerializedAnswer, maxScore = 3) {
  if (answer.type !== "score") return 0;
  return clamp01(answer.score / maxScore);
}

export function noulPct(answer: SerializedAnswer) {
  if (answer.type !== "noul") return 0;
  return clamp01(answer.noul);
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export type VerdictTone = "danger" | "warn" | "ok";

export function verdictTone(answers: ReviewAnswers): VerdictTone {
  const verdict = answers.verdict.type === "choice" ? answers.verdict.choice : "";
  const blocker = answers.merge_blocker.type === "noul" ? answers.merge_blocker.noul : 0;
  const confidence = answers.verdict.type === "choice" ? answers.verdict.confidence : 0;

  if (verdict === "block" || blocker >= 0.65) return "danger";
  if (verdict === "request_changes" || confidence < 0.55) return "warn";
  return "ok";
}

export function toneColor(tone: VerdictTone) {
  if (tone === "danger") return "var(--danger)";
  if (tone === "warn") return "var(--warn)";
  return "var(--accent)";
}
