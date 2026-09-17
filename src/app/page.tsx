"use client";

import { FormEvent, useMemo, useState } from "react";

import { SAMPLE_PR } from "@/lib/sample-pr";
import type { ReviewAnswers, ReviewResponse, SerializedAnswer } from "@/lib/types";

type FormState = {
  title: string;
  body: string;
  diff: string;
  ciLog: string;
  linkedIssue: string;
};

const EMPTY: FormState = {
  title: "",
  body: "",
  diff: "",
  ciLog: "",
  linkedIssue: "",
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function scoreToPct(answer: SerializedAnswer, maxScore = 3) {
  if (answer.type !== "score") return 0;
  return clamp01(answer.score / maxScore);
}

function noulPct(answer: SerializedAnswer) {
  if (answer.type !== "noul") return 0;
  return clamp01(answer.noul);
}

function verdictTone(answers: ReviewAnswers): "danger" | "warn" | "ok" {
  const verdict = answers.verdict.type === "choice" ? answers.verdict.choice : "";
  const blocker = answers.merge_blocker.type === "noul" ? answers.merge_blocker.noul : 0;
  const confidence =
    answers.verdict.type === "choice" ? answers.verdict.confidence : 0;

  if (verdict === "block" || blocker >= 0.65) return "danger";
  if (verdict === "request_changes" || confidence < 0.55) return "warn";
  return "ok";
}

function toneColor(tone: "danger" | "warn" | "ok") {
  if (tone === "danger") return "var(--danger)";
  if (tone === "warn") return "var(--warn)";
  return "var(--accent)";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function ProbBar({
  label,
  value,
  color = "var(--accent)",
  detail,
}: {
  label: string;
  value: number;
  color?: string;
  detail?: string;
}) {
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-medium tabular-nums" style={{ color }}>
          {detail ?? `${pct}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="animate-bar h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function ChoicePanel({ answer }: { answer: SerializedAnswer }) {
  if (answer.type !== "choice") return null;
  const entries = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      {entries.map(([key, prob]) => (
        <ProbBar
          key={key}
          label={formatLabel(key)}
          value={prob}
          color={key === answer.choice ? "var(--accent)" : "var(--info)"}
          detail={`${Math.round(prob * 100)}%`}
        />
      ))}
      <p className="text-xs text-[var(--muted)]">
        confidence {Math.round(answer.confidence * 100)}%
      </p>
    </div>
  );
}

function Results({ data }: { data: ReviewResponse }) {
  const tone = verdictTone(data.answers);
  const color = toneColor(tone);
  const verdict =
    data.answers.verdict.type === "choice"
      ? formatLabel(data.answers.verdict.choice)
      : "—";
  const depth =
    data.answers.review_depth.type === "choice"
      ? formatLabel(data.answers.review_depth.choice)
      : "—";

  const humanLook =
    (data.answers.verdict.type === "choice" &&
      data.answers.verdict.confidence < 0.55) ||
    tone === "warn";

  return (
    <section className="animate-rise space-y-6">
      <div
        className="rounded-2xl border px-5 py-5"
        style={{
          borderColor: `${color}55`,
          background: `linear-gradient(135deg, ${color}14, rgba(255,255,255,0.02))`,
        }}
      >
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Final verdict · Jev
        </p>
        <h2 className="mt-2 text-3xl font-semibold capitalize" style={{ color }}>
          {verdict}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Review depth: <span className="text-[var(--text)]">{depth}</span>
          {humanLook ? " · amber: human look recommended" : null}
        </p>
        <p className="mt-3 font-mono text-xs text-[var(--muted)]">
          {data.latency_ms} ms · {data.model} · {data.usage.input_tokens}+
          {data.usage.output_tokens} tokens
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[rgba(10,14,20,0.55)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Risk router
          </h3>
          <ProbBar
            label="Overall risk"
            value={scoreToPct(data.answers.risk)}
            color="var(--danger)"
            detail={
              data.answers.risk.type === "score"
                ? `${data.answers.risk.score.toFixed(2)} / 3`
                : undefined
            }
          />
          <ProbBar
            label="Merge blocker"
            value={noulPct(data.answers.merge_blocker)}
            color="var(--danger)"
          />
          <ProbBar
            label="Needs design"
            value={noulPct(data.answers.needs_design)}
            color="var(--warn)"
          />
          <ProbBar
            label="Needs security"
            value={noulPct(data.answers.needs_security)}
            color="var(--warn)"
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[rgba(10,14,20,0.55)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Review coach
          </h3>
          <ProbBar
            label="Missing tests"
            value={scoreToPct(data.answers.missing_tests)}
            color="var(--warn)"
            detail={
              data.answers.missing_tests.type === "score"
                ? `${data.answers.missing_tests.score.toFixed(2)} / 3`
                : undefined
            }
          />
          <ProbBar
            label="Docs debt"
            value={scoreToPct(data.answers.docs_debt)}
            color="var(--info)"
            detail={
              data.answers.docs_debt.type === "score"
                ? `${data.answers.docs_debt.score.toFixed(2)} / 3`
                : undefined
            }
          />
          <ProbBar
            label="Blast radius"
            value={scoreToPct(data.answers.blast_radius)}
            color="var(--danger)"
            detail={
              data.answers.blast_radius.type === "score"
                ? `${data.answers.blast_radius.score.toFixed(2)} / 3`
                : undefined
            }
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-[rgba(10,14,20,0.55)] p-5">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Review depth distribution
          </h3>
          <ChoicePanel answer={data.answers.review_depth} />
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[rgba(10,14,20,0.55)] p-5">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Verdict distribution
          </h3>
          <ChoicePanel answer={data.answers.verdict} />
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);

  const canSubmit = useMemo(
    () => form.title.trim().length > 0 && form.diff.trim().length > 0,
    [form.diff, form.title],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function loadSample() {
    setForm({
      title: SAMPLE_PR.title,
      body: SAMPLE_PR.body,
      diff: SAMPLE_PR.diff,
      ciLog: SAMPLE_PR.ciLog ?? "",
      linkedIssue: SAMPLE_PR.linkedIssue ?? "",
    });
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          diff: form.diff,
          ciLog: form.ciLog || undefined,
          linkedIssue: form.linkedIssue || undefined,
        }),
      });

      const data = (await res.json()) as ReviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <header className="animate-rise mb-10 max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] text-[var(--accent)] uppercase">
          <span className="animate-pulse-soft inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          TypeSafe Jev · systemOne
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">DiffJury</h1>
        <p className="mt-4 text-lg text-[var(--muted)] sm:text-xl">
          Jev decides if this PR ships. No essays. Just judgments.
        </p>
      </header>

      <form onSubmit={onSubmit} className="animate-rise-delay space-y-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={loadSample}>
            Load sample PR
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || loading}>
            {loading ? "Judging…" : "Analyze PR"}
          </button>
        </div>

        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="field"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="feat(auth): add session refresh middleware"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="body">
            Body
          </label>
          <textarea
            id="body"
            className="field field-mono min-h-28"
            value={form.body}
            onChange={(e) => update("body", e.target.value)}
            placeholder="PR description, test plan, rollout notes…"
          />
        </div>

        <div>
          <label className="label" htmlFor="diff">
            Diff
          </label>
          <textarea
            id="diff"
            className="field field-mono min-h-48"
            value={form.diff}
            onChange={(e) => update("diff", e.target.value)}
            placeholder="Paste the unified diff…"
            required
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="ciLog">
              CI log (optional)
            </label>
            <textarea
              id="ciLog"
              className="field field-mono min-h-28"
              value={form.ciLog}
              onChange={(e) => update("ciLog", e.target.value)}
              placeholder="Test / lint / typecheck output"
            />
          </div>
          <div>
            <label className="label" htmlFor="linkedIssue">
              Linked issue (optional)
            </label>
            <textarea
              id="linkedIssue"
              className="field field-mono min-h-28"
              value={form.linkedIssue}
              onChange={(e) => update("linkedIssue", e.target.value)}
              placeholder="#482 Users get intermittent 401s…"
            />
          </div>
        </div>
      </form>

      {error ? (
        <p className="mt-6 rounded-xl border border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-10">
          <Results data={result} />
        </div>
      ) : null}

      <footer className="mt-16 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        Powered by TypeSafe Jev · decisions only
      </footer>
    </main>
  );
}
