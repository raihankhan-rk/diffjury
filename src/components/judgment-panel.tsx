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

function SegmentedBar({ answer }: { answer: SerializedAnswer }) {
  if (answer.type !== "choice") return null;
  const entries = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="segment">
      <div className="segment-track">
        {entries.map(([key, prob]) => (
          <span
            key={key}
            className={`segment-fill ${key === answer.choice ? "is-winner" : ""}`}
            style={{ width: `${Math.max(clamp01(prob) * 100, 0)}%` }}
            title={`${formatLabel(key)} ${Math.round(prob * 100)}%`}
          />
        ))}
      </div>
      <div className="segment-legend">
        {entries.map(([key, prob]) => (
          <span key={key} className={key === answer.choice ? "is-winner" : ""}>
            {formatLabel(key)} {Math.round(prob * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function RiskRing({ value, color }: { value: number; color: string }) {
  const pct = clamp01(value);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="risk-ring" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r={r} className="risk-ring-track" />
      <circle
        cx="36"
        cy="36"
        r={r}
        className="risk-ring-value"
        style={{
          stroke: color,
          strokeDasharray: `${c}`,
          strokeDashoffset: `${c * (1 - pct)}`,
        }}
      />
      <text x="36" y="40" textAnchor="middle">
        {Math.round(pct * 100)}
      </text>
    </svg>
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
  const confidence =
    data.answers.verdict.type === "choice"
      ? Math.round(data.answers.verdict.confidence * 100)
      : null;

  return (
    <div className="judgment animate-rise">
      <div
        className="verdict-card"
        style={{
          borderColor: `${color}55`,
          background: `radial-gradient(120% 140% at 100% 0%, ${color}22, transparent 46%), linear-gradient(180deg, #fff, ${color}0d)`,
        }}
      >
        <div className="verdict-copy">
          <p className="eyebrow">Verdict · Jev</p>
          <h2 style={{ color }}>{verdict}</h2>
          <div className="verdict-chips">
            <span className="verdict-chip">{depth}</span>
            {humanLook ? (
              <span className="verdict-chip is-warn">human look</span>
            ) : null}
            {confidence != null ? (
              <span className="verdict-chip">{confidence}% conf</span>
            ) : null}
          </div>
          <p className="verdict-meta">
            {data.latency_ms} ms · {data.model} · {data.usage.input_tokens}+
            {data.usage.output_tokens} tok
          </p>
        </div>
        <div className="verdict-meter">
          <RiskRing value={scoreToPct(data.answers.risk)} color={color} />
          <span>overall risk</span>
        </div>
      </div>

      <div className="judgment-grid">
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
      </div>

      <div className="judgment-grid">
        <section className="panel">
          <h3>Review depth</h3>
          <SegmentedBar answer={data.answers.review_depth} />
        </section>
        <section className="panel">
          <h3>Verdict mix</h3>
          <SegmentedBar answer={data.answers.verdict} />
        </section>
      </div>
    </div>
  );
}
