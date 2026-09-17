import { GitHubIcon } from "@/components/github-icon";
import { REPO_SLUG, REPO_URL } from "@/lib/site";

export function RepoLink() {
  return (
    <a
      className="repo-link"
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open source repository ${REPO_SLUG} on GitHub`}
    >
      <GitHubIcon size={18} />
      <span className="repo-link-name">{REPO_SLUG}</span>
    </a>
  );
}
