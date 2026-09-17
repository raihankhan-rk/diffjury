import { FormEvent } from "react";

import { Mark } from "@/components/mark";

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

      <main className="landing-center">
        <div className="landing-brand animate-rise">
          <Mark size={44} />
          <h1>DiffJury</h1>
        </div>
        <p className="landing-tagline animate-rise-delay">
          Jev decides if this PR ships.
        </p>

        <form className="composer-wrap animate-rise-delay" onSubmit={onAnalyze}>
          <label className="sr-only" htmlFor="pr-url">
            Public GitHub pull request URL
          </label>
          <div className={`composer ${busy ? "is-busy" : ""} ${error ? "is-error" : ""}`}>
            <span className="composer-icon" aria-hidden>
              <GitHubGlyph />
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

function GitHubGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.86.12 3.16.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}
