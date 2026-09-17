"use client";

import { FormEvent, useState } from "react";

import { LandingScreen } from "@/components/landing-screen";
import { ResultScreen } from "@/components/result-screen";
import { parsePrUrl, type GithubPrPayload } from "@/lib/github";
import { SAMPLE_PR_URL } from "@/lib/sample-pr";
import type { ReviewResponse } from "@/lib/types";

type Phase = "landing" | "fetching" | "judging" | "result";

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
    setPhase("fetching");

    try {
      const prRes = await fetch("/api/github-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl.trim() }),
      });
      const prData = (await prRes.json()) as GithubPrPayload & { error?: string };
      if (!prRes.ok) {
        throw new Error(prData.error || `Failed to fetch PR (${prRes.status})`);
      }

      setPhase("judging");

      const reviewRes = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: prData.title,
          body: prData.body ?? "",
          diff: prData.diff,
          linkedIssue:
            prData.linkedIssues?.length > 0
              ? prData.linkedIssues.join(", ")
              : undefined,
        }),
      });
      const reviewData = (await reviewRes.json()) as ReviewResponse & {
        error?: string;
      };
      if (!reviewRes.ok) {
        throw new Error(reviewData.error || `Review failed (${reviewRes.status})`);
      }

      setDossier(prData);
      setReview(reviewData);
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
    if (phase === "fetching" || phase === "judging") return;
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
