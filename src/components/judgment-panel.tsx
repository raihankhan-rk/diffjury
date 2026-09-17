import type { CSSProperties, ReactNode } from "react";

import type { ReviewResponse, SerializedAnswer } from "@/lib/types";
import {
  clamp01,
  formatLabel,
  noulPct,
  scoreToPct,
  toneColor,
  verdictTone,
} from "@/lib/verdict";

function RiskDial({
  value,
  color,
  detail,
}: {
  value: number;
  color: string;
  detail: string;
}) {
  const pct = clamp01(value);
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg className="risk-dial" viewBox="0 0 84 84" aria-hidden>
      <circle cx="42" cy="42" r={r} className="risk-dial-track" />
      <circle
        cx="42"
        cy="42"
        r={r}
        className="risk-dial-value"
        style={{
          stroke: color,
          strokeDasharray: `${c}`,
          strokeDashoffset: `${c * (1 - pct)}`,
        }}
      />
      <text x="42" y="40" textAnchor="middle" className="risk-dial-number">
        {detail}
      </text>
      <text x="42" y="53" textAnchor="middle" className="risk-dial-label">
        risk
      </text>
    </svg>
  );
}

function Icon({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "watch" | "high";
}) {
  return <span className={`judgment-icon is-${tone}`}>{children}</span>;
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" />
      <path d="m9.3 12 1.8 1.8 3.8-4" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7" cy="5" r="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
      <path d="M7 7v10M7 9h5a5 5 0 0 1 5 5v3" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m12 3 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4M4 17l8 4 8-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function confidenceValue(answer: SerializedAnswer): number {
  return answer.type === "choice" || answer.type === "score"
    ? clamp01(answer.confidence)
    : 0;
}

function scoreValue(answer: SerializedAnswer): number {
  return answer.type === "score" ? clamp01(answer.score / 3) : 0;
}

function severity(value: number): "ok" | "watch" | "high" {
  if (value >= 0.67) return "high";
  if (value >= 0.34) return "watch";
  return "ok";
}

function severityLabel(value: number): string {
  const level = severity(value);
  if (level === "high") return "Priority";
  if (level === "watch") return "Review";
  return "Clear";
}

function routeCopy(label: string, value: number): string {
  const level = severity(value);
  if (label === "Merge blocker") {
    return level === "high"
      ? "Resolve before merge"
      : level === "watch"
        ? "Verify before merge"
        : "No blocker detected";
  }
  if (level === "high") return `Route to ${label.toLowerCase()} reviewer`;
  if (level === "watch") return `Give ${label.toLowerCase()} a closer look`;
  return `No ${label.toLowerCase()} review needed`;
}

function verdictPresentation(verdict: string) {
  if (verdict === "block") {
    return {
      kicker: "Do not merge",
      title: "Stop the merge",
      copy: "Major issues need resolution before this PR moves forward.",
    };
  }
  if (verdict === "request_changes") {
    return {
      kicker: "Changes requested",
      title: "Fix before merge",
      copy: "Address the flagged review areas, then run the jury again.",
    };
  }
  return {
    kicker: "Merge recommendation",
    title: "Ready with follow-up",
    copy: "Safe to proceed; capture remaining nits as follow-up work.",
  };
}

function FocusRow({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  const level = severity(value);
  return (
    <div className="focus-row">
      <div className="focus-rank">
        <span className={`focus-dot is-${level}`} />
      </div>
      <div className="focus-copy">
        <div className="focus-label">
          <strong>{label}</strong>
          <span className={`signal-state is-${level}`}>{severityLabel(value)}</span>
        </div>
        <p>{note}</p>
      </div>
      <div className="focus-score">
        <strong>{Math.round(value * 100)}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

export function JudgmentPanel({ data }: { data: ReviewResponse }) {
  const tone = verdictTone(data.answers);
  const color = toneColor(tone);
  const verdict =
    data.answers.verdict.type === "choice" ? data.answers.verdict.choice : "";
  const depth =
    data.answers.review_depth.type === "choice"
      ? formatLabel(data.answers.review_depth.choice)
      : "standard";
  const confidence = confidenceValue(data.answers.verdict);
  const risk = scoreToPct(data.answers.risk);
  const presentation = verdictPresentation(verdict);
  const routes = [
    {
      label: "Merge blocker",
      value: noulPct(data.answers.merge_blocker),
      icon: <BranchIcon />,
    },
    {
      label: "Security",
      value: noulPct(data.answers.needs_security),
      icon: <ShieldIcon />,
    },
    {
      label: "Design",
      value: noulPct(data.answers.needs_design),
      icon: <LayersIcon />,
    },
  ];
  const focus = [
    {
      label: "Test coverage",
      value: scoreValue(data.answers.missing_tests),
      note: "How much important behavior appears untested.",
    },
    {
      label: "Blast radius",
      value: scoreValue(data.answers.blast_radius),
      note: "How broadly a defect could affect the system.",
    },
    {
      label: "Documentation",
      value: scoreValue(data.answers.docs_debt),
      note: "How much context maintainers may be missing.",
    },
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="judgment animate-rise">
      <section
        className="decision-hero"
        style={{
          "--verdict-color": color,
          background: `radial-gradient(80% 130% at 100% 0%, ${color}44, transparent 58%), #111c2a`,
        } as CSSProperties}
      >
        <div className="decision-copy">
          <div className="decision-kicker">
            <span className="decision-live" />
            {presentation.kicker}
          </div>
          <h2>{presentation.title}</h2>
          <p>{presentation.copy}</p>
          <div className="decision-meta">
            <span>{depth} review</span>
            <span>{Math.round(confidence * 100)}% verdict confidence</span>
          </div>
        </div>
        <RiskDial
          value={risk}
          color={color}
          detail={data.answers.risk.type === "score" ? data.answers.risk.score.toFixed(1) : "—"}
        />
      </section>

      <section className="judgment-card route-card">
        <div className="judgment-heading">
          <div>
            <p className="eyebrow">Reviewer routing</p>
            <h3>Who needs to look?</h3>
          </div>
          <span>Jev signals</span>
        </div>
        <div className="route-grid">
          {routes.map((route) => {
            const level = severity(route.value);
            return (
              <div className={`route-item is-${level}`} key={route.label}>
                <Icon tone={level}>{route.icon}</Icon>
                <div>
                  <div className="route-title">
                    <strong>{route.label}</strong>
                    <span>{Math.round(route.value * 100)}%</span>
                  </div>
                  <p>{routeCopy(route.label, route.value)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="judgment-card focus-card">
        <div className="judgment-heading">
          <div>
            <p className="eyebrow">Review plan</p>
            <h3>Start here</h3>
          </div>
          <Icon tone="neutral">
            <CheckIcon />
          </Icon>
        </div>
        <div className="focus-list">
          {focus.map((item) => (
            <FocusRow key={item.label} {...item} />
          ))}
        </div>
      </section>

      <footer className="judgment-foot">
        <span>Jev {data.model.replace(/^jev-?/, "")}</span>
        <span>{data.latency_ms} ms</span>
        <span>{data.usage.input_tokens + data.usage.output_tokens} tokens</span>
      </footer>
    </div>
  );
}
