import { Avatar } from "@/components/avatar";
import { DiffPanel } from "@/components/diff-panel";
import { PrBody } from "@/components/pr-body";
import {
  githubProfileUrl,
  issueUrl,
  type GithubPerson,
  type GithubPrPayload,
} from "@/lib/github";

function statusLabel(pr: GithubPrPayload) {
  if (pr.merged) return "Merged";
  if (pr.draft) return "Draft";
  if (pr.state) return pr.state.charAt(0).toUpperCase() + pr.state.slice(1);
  return null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PersonChip({
  person,
  badge,
}: {
  person: GithubPerson;
  badge?: string;
}) {
  const href = githubProfileUrl(person);
  const inner = (
    <>
      <Avatar person={person} size={32} />
      <span>{person.login}</span>
      {badge ? <em>{badge}</em> : null}
    </>
  );

  if (href) {
    return (
      <a className="person-chip" href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }

  return <span className="person-chip">{inner}</span>;
}

export function DossierPanel({ pr }: { pr: GithubPrPayload }) {
  const status = statusLabel(pr);
  const opened = formatDate(pr.createdAt);
  const authorLogin = pr.author?.login;

  return (
    <article className="dossier animate-rise">
      <header className="dossier-head">
        <p className="eyebrow">
          {pr.owner}/{pr.repo}
        </p>
        <h1>{pr.title}</h1>
        <div className="dossier-meta">
          <span className="pill">#{pr.number}</span>
          {status ? <span className="pill">{status}</span> : null}
          {opened ? <span className="pill-quiet">{opened}</span> : null}
          {pr.additions != null && pr.deletions != null ? (
            <span className="pill-quiet">
              <span className="add">+{pr.additions}</span>
              <span className="del">−{pr.deletions}</span>
              {pr.changedFiles != null ? (
                <span>
                  · {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        {pr.linkedIssues.length > 0 ? (
          <div className="issue-row">
            <span className="issue-label">Linked issues</span>
            {pr.linkedIssues.map((issue) => (
              <a
                key={issue}
                className="issue-chip"
                href={issueUrl(pr.owner, pr.repo, issue)}
                target="_blank"
                rel="noreferrer"
              >
                {issue}
              </a>
            ))}
          </div>
        ) : null}
        <a className="pr-url" href={pr.htmlUrl} target="_blank" rel="noreferrer">
          {pr.htmlUrl}
        </a>
      </header>

      {pr.contributors.length > 0 ? (
        <section className="dossier-section">
          <h2>Contributors</h2>
          <div className="person-row">
            {pr.contributors.map((person) => (
              <PersonChip
                key={person.login}
                person={person}
                badge={authorLogin && person.login === authorLogin ? "author" : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="dossier-section">
        <h2>Description</h2>
        <PrBody text={pr.body} owner={pr.owner} repo={pr.repo} />
      </section>

      <section className="dossier-section">
        <h2>Diff</h2>
        <DiffPanel diff={pr.diff} />
      </section>
    </article>
  );
}
