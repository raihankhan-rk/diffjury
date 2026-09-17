import { DossierPanel } from "@/components/dossier-panel";
import { JudgmentPanel } from "@/components/judgment-panel";
import { Mark } from "@/components/mark";
import { RepoLink } from "@/components/repo-link";
import type { GithubPrPayload } from "@/lib/github";
import type { ReviewResponse } from "@/lib/types";

export function ResultScreen({
  pr,
  review,
  onReset,
}: {
  pr: GithubPrPayload;
  review: ReviewResponse;
  onReset: () => void;
}) {
  return (
    <div className="workspace">
      <header className="workspace-bar">
        <button type="button" className="brand-btn" onClick={onReset}>
          <Mark size={32} />
          <span>DiffJury</span>
        </button>
        <div className="workspace-actions">
          <RepoLink />
          <button type="button" className="btn-quiet" onClick={onReset}>
            Analyze another
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="workspace-left">
          <DossierPanel pr={pr} />
        </section>
        <aside className="workspace-right">
          <JudgmentPanel data={review} />
        </aside>
      </div>
    </div>
  );
}
