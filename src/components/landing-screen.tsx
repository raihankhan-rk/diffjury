import { FormEvent } from "react";

import { GitHubIcon } from "@/components/github-icon";
import { Mark } from "@/components/mark";
import { RepoLink } from "@/components/repo-link";
import { TAGLINE } from "@/lib/site";

type Phase = "landing" | "fetching" | "judging";

export function LandingScreen({
  prUrl,
  onUrlChange,
  onAnalyze,
  onSample,
  sampleUrl,
  phase,
  error,
}: {
  prUrl: string;
  onUrlChange: (value: string) => void;
  onAnalyze: (event: FormEvent) => void;
  onSample: () => void;
  sampleUrl: string;
  phase: Phase;
  error: string | null;
}) {
  const busy = phase !== "landing";
  const status =
    phase === "fetching" ? "Fetching PR…" : phase === "judging" ? "Judging…" : null;

  return (
    <div className="landing">
      <div className="landing-orb landing-orb-a" aria-hidden />
      <div className="landing-orb landing-orb-b" aria-hidden />
      <div className="landing-orb landing-orb-c" aria-hidden />

      <header className="landing-top">
        <RepoLink />
      </header>

      <main className="landing-center">
        <div className="landing-brand animate-rise">
          <Mark size={44} />
          <h1>DiffJury</h1>
        </div>
        <p className="landing-tagline animate-rise-delay">{TAGLINE}.</p>

        <form className="composer-wrap animate-rise-delay" onSubmit={onAnalyze}>
          <label className="sr-only" htmlFor="pr-url">
            Public GitHub pull request URL
          </label>
          <div className={`composer ${busy ? "is-busy" : ""} ${error ? "is-error" : ""}`}>
            <span className="composer-icon" aria-hidden>
              <GitHubIcon />
            </span>
            <input
              id="pr-url"
              value={prUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={busy}
            />
            <button type="submit" className="btn-analyze" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {status}
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>

          <div className="composer-meta" aria-live="polite">
            {error ? (
              <p className="composer-error">{error}</p>
            ) : (
              <p className="composer-help">
                Paste a public GitHub pull request. One click fetches the dossier and
                runs Jev.
              </p>
            )}
          </div>
        </form>

        <button
          type="button"
          className="sample-chip"
          onClick={onSample}
          disabled={busy}
        >
          Try a sample PR
          <span className="sample-chip-url">{sampleUrl.replace("https://", "")}</span>
        </button>
      </main>

      <footer className="landing-foot">Powered by TypeSafe Jev · decisions only</footer>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

