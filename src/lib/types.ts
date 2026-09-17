export type ReviewInput = {
  title: string;
  body: string;
  diff: string;
  ciLog?: string;
  linkedIssue?: string;
};

export type SerializedAnswer =
  | {
      type: "noul";
      noul: number;
    }
  | {
      type: "choice";
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    }
  | {
      type: "score";
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
      legend: Record<string, string>;
    };

export type ReviewAnswers = {
  risk: SerializedAnswer;
  review_depth: SerializedAnswer;
  needs_design: SerializedAnswer;
  needs_security: SerializedAnswer;
  merge_blocker: SerializedAnswer;
  missing_tests: SerializedAnswer;
  docs_debt: SerializedAnswer;
  blast_radius: SerializedAnswer;
  verdict: SerializedAnswer;
};

export type ReviewResponse = {
  answers: ReviewAnswers;
  model: string;
  latency_ms: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export function buildPrState(input: ReviewInput): string {
  const sections = [
    `PR TITLE:\n${input.title.trim()}`,
    `PR BODY:\n${input.body.trim() || "(empty)"}`,
    `DIFF:\n${input.diff.trim()}`,
  ];

  if (input.ciLog?.trim()) {
    sections.push(`CI LOG:\n${input.ciLog.trim()}`);
  }

  if (input.linkedIssue?.trim()) {
    sections.push(`LINKED ISSUE:\n${input.linkedIssue.trim()}`);
  }

  return sections.join("\n\n");
}
