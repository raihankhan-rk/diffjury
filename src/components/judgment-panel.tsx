import type { ReviewResponse, SerializedAnswer } from "@/lib/types";
import {
  clamp01,
  formatLabel,
  noulPct,
  scoreToPct,
  toneColor,
  verdictTone,
} from "@/lib/verdict";

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
    <div className="prob">
      <div className="prob-row">
        <span>{label}</span>
        <span className="prob-val" style={{ color }}>
          {detail ?? `${pct}%`}
        </span>
      </div>
      <div className="bar-track">
        <div
          className="animate-bar bar-fill"
          style={{ width: `${pct}%`, background: color }}
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
        />
      ))}
      <p className="choice-note">
        confidence {Math.round(answer.confidence * 100)}%
      </p>
    </div>
  );
}

function scoreDetail(answer: SerializedAnswer) {
  return answer.type === "score" ? `${answer.score.toFixed(2)} / 3` : undefined;
}

function choiceLabel(answer: SerializedAnswer) {
  return answer.type === "choice" ? formatLabel(answer.choice) : "—";
}

export function JudgmentPanel({ data }: { data: ReviewResponse }) {
  const tone = verdictTone(data.answers);
  const color = toneColor(tone);
  const verdict = choiceLabel(data.answers.verdict);
  const depth = choiceLabel(data.answers.review_depth);
  const humanLook =
    (data.answers.verdict.type === "choice" &&
      data.answers.verdict.confidence < 0.55) ||
    tone === "warn";

  return (
    <div className="judgment animate-rise">
      <div
        className="verdict-card"
        style={{
          borderColor: `${color}40`,
          background: `linear-gradient(180deg, ${color}12, rgba(255,255,255,0.92))`,
        }}
      >
        <p className="eyebrow">Verdict · Jev</p>
        <h2 style={{ color }}>{verdict}</h2>
        <p className="verdict-sub">
          Review depth: <strong>{depth}</strong>
          {humanLook ? " · human look recommended" : null}
        </p>
        <p className="verdict-meta">
          {data.latency_ms} ms · {data.model} · {data.usage.input_tokens}+
          {data.usage.output_tokens} tokens
        </p>
      </div>

      <section className="panel">
        <h3>Risk router</h3>
        <ProbBar
          label="Overall risk"
          value={scoreToPct(data.answers.risk)}
          color="var(--danger)"
          detail={scoreDetail(data.answers.risk)}
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
      </section>

      <section className="panel">
        <h3>Review coach</h3>
        <ProbBar
          label="Missing tests"
          value={scoreToPct(data.answers.missing_tests)}
          color="var(--warn)"
          detail={scoreDetail(data.answers.missing_tests)}
        />
        <ProbBar
          label="Docs debt"
          value={scoreToPct(data.answers.docs_debt)}
          color="var(--info)"
          detail={scoreDetail(data.answers.docs_debt)}
        />
        <ProbBar
          label="Blast radius"
          value={scoreToPct(data.answers.blast_radius)}
          color="var(--danger)"
          detail={scoreDetail(data.answers.blast_radius)}
        />
      </section>

      <section className="panel">
        <h3>Review depth</h3>
        <ChoicePanel answer={data.answers.review_depth} />
      </section>

      <section className="panel">
        <h3>Verdict distribution</h3>
        <ChoicePanel answer={data.answers.verdict} />
      </section>
    </div>
  );
}
