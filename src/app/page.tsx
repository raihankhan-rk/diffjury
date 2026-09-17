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

type GithubPrPayload = {
  title: string;
  body: string;
  diff: string;
  author: string | null;
  contributors: string[];
  linkedIssues: string[];
  htmlUrl: string;
  number: number;
  owner: string;
  repo: string;
  error?: string;
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
      <div className="bar-track h-2 overflow-hidden rounded-full">
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
    <section className="animate-rise space-y-5">
      <div
        className="rounded-2xl border px-5 py-5"
        style={{
          borderColor: `${color}55`,
          background: `linear-gradient(135deg, ${color}14, rgba(255,255,255,0.9))`,
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

      <div className="grid gap-4">
        <div className="panel space-y-4 p-5">
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

        <div className="panel space-y-4 p-5">
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

        <div className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Review depth distribution
          </h3>
          <ChoicePanel answer={data.answers.review_depth} />
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
            Verdict distribution
          </h3>
          <ChoicePanel answer={data.answers.verdict} />
        </div>
      </div>
    </section>
  );
}

function EmptyResults() {
  return (
    <div className="animate-fade flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.45)] px-6 py-12 text-center">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[var(--accent)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v18M5 10l7-7 7 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-base font-medium text-[var(--text)]">
        Run Analyze to see Jev&apos;s judgment
      </p>
      <p className="mt-2 max-w-xs text-sm text-[var(--muted)]">
        Paste a PR or load the sample, then hit Analyze. Verdicts land here.
      </p>
    </div>
  );
}

export default function HomePage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [prUrl, setPrUrl] = useState("");
  const [contributors, setContributors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPr, setFetchingPr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prFetchError, setPrFetchError] = useState<string | null>(null);
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
    setContributors([]);
    setPrUrl("");
    setError(null);
    setPrFetchError(null);
  }

  async function fetchGithubPr() {
    if (!prUrl.trim() || fetchingPr) return;
    setFetchingPr(true);
    setPrFetchError(null);
    setError(null);

    try {
      const res = await fetch("/api/github-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: prUrl.trim() }),
      });
      const data = (await res.json()) as GithubPrPayload;
      if (!res.ok) {
        throw new Error(data.error || `Failed to fetch PR (${res.status})`);
      }

      const linked =
        data.linkedIssues?.length > 0
          ? data.linkedIssues.join(", ")
          : "";

      setForm((prev) => ({
        ...prev,
        title: data.title,
        body: data.body,
        diff: data.diff,
        linkedIssue: linked || prev.linkedIssue,
      }));
      setContributors(data.contributors ?? []);
    } catch (err) {
      setPrFetchError(err instanceof Error ? err.message : "Failed to fetch PR");
      setContributors([]);
    } finally {
      setFetchingPr(false);
    }
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
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
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

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
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
            <label className="label" htmlFor="prUrl">
              GitHub PR URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="prUrl"
                className="field"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/123"
                inputMode="url"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-ghost shrink-0 sm:self-stretch"
                onClick={fetchGithubPr}
                disabled={!prUrl.trim() || fetchingPr}
              >
                {fetchingPr ? "Fetching…" : "Fetch PR"}
              </button>
            </div>
            {prFetchError ? (
              <p className="mt-2 text-sm text-[var(--danger)]">{prFetchError}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Public PRs only. Optional server <code className="font-mono">GITHUB_TOKEN</code>{" "}
                raises rate limits.
              </p>
            )}
          </div>

          {contributors.length > 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
                Contributors
              </p>
              <p className="mt-1.5 text-sm text-[var(--text)]">{contributors.join(" · ")}</p>
            </div>
          ) : null}

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

          {error ? (
            <p className="rounded-xl border border-[rgba(214,69,80,0.28)] bg-[rgba(214,69,80,0.06)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </form>

        <aside className="animate-rise-delay lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
              Judgment
            </h2>
            {result ? (
              <span className="font-mono text-xs text-[var(--muted)]">live</span>
            ) : null}
          </div>
          {result ? <Results data={result} /> : <EmptyResults />}
        </aside>
      </div>

      <footer className="mt-16 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        Powered by TypeSafe Jev · decisions only
      </footer>
    </main>
  );
}
