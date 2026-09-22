"use client";

import { FormEvent, useState } from "react";

import { LandingScreen } from "@/components/landing-screen";
import { ResultScreen } from "@/components/result-screen";
import { parsePrUrl, type GithubPrPayload } from "@/lib/github";
import { SAMPLE_PR_URL } from "@/lib/sample-pr";
import type { ReviewResponse } from "@/lib/types";

type Phase = "landing" | "analyzing" | "result";

export default function HomePage() {
  const [prUrl, setPrUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("landing");
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<GithubPrPayload | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);

  async function analyzeUrl(rawUrl: string) {
    const parsed = parsePrUrl(rawUrl);
    if (!parsed) {
      setError(
        "Paste a public GitHub pull request URL, like https://github.com/owner/repo/pull/123",
      );
      setPhase("landing");
      setDossier(null);
      setReview(null);
      return;
    }

    setError(null);
    setDossier(null);
    setReview(null);
    setPhase("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      const data = (await res.json()) as {
        pr?: GithubPrPayload;
        review?: ReviewResponse;
        error?: string;
      };
      if (!res.ok || !data.pr || !data.review) {
        throw new Error(data.error || `Failed to analyze PR (${res.status})`);
      }

      setDossier(data.pr);
      setReview(data.review);
      setPhase("result");
    } catch (err) {
      setDossier(null);
      setReview(null);
      setPhase("landing");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function onAnalyze(event: FormEvent) {
    event.preventDefault();
    if (phase === "analyzing") return;
    void analyzeUrl(prUrl);
  }

  function onSample() {
    setPrUrl(SAMPLE_PR_URL);
    setError(null);
  }

  function onReset() {
    setPhase("landing");
    setDossier(null);
    setReview(null);
    setError(null);
  }

  if (phase === "result" && dossier && review) {
    return <ResultScreen pr={dossier} review={review} onReset={onReset} />;
  }

  return (
    <LandingScreen
      prUrl={prUrl}
      onUrlChange={setPrUrl}
      onAnalyze={onAnalyze}
      onSample={onSample}
      sampleUrl={SAMPLE_PR_URL}
      phase={phase === "result" ? "landing" : phase}
      error={error}
    />
  );
}
