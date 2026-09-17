import type { ReactNode } from "react";

import { issueUrl } from "@/lib/github";

function renderInline(text: string, owner?: string, repo?: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s)<]+|#\d+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={i}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={i} className="inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const href = match[2];
      nodes.push(
        <a key={i} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>,
      );
    } else if (token.startsWith("#") && owner && repo) {
      nodes.push(
        <a key={i} href={issueUrl(owner, repo, token)} target="_blank" rel="noreferrer">
          {token}
        </a>,
      );
    } else if (token.startsWith("http")) {
      nodes.push(
        <a key={i} href={token} target="_blank" rel="noreferrer">
          {token}
        </a>,
      );
    } else {
      nodes.push(token);
    }
    i += 1;
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Block({
  text,
  owner,
  repo,
}: {
  text: string;
  owner?: string;
  repo?: string;
}) {
  const lines = text.split("\n");
  const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0] ?? "");
  if (heading) {
    const Tag = heading[1].length === 1 ? "h3" : heading[1].length === 2 ? "h4" : "h5";
    return (
      <Tag className="pr-heading">
        {renderInline(heading[2], owner, repo)}
        {lines.length > 1 ? (
          <span className="mt-2 block font-normal">
            {renderInline(lines.slice(1).join("\n"), owner, repo)}
          </span>
        ) : null}
      </Tag>
    );
  }

  const hasList = lines.some((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line));
  const listish = lines.every(
    (line) => !line.trim() || /^\s*(?:[-*]|\d+\.)\s+/.test(line),
  );
  if (listish && hasList) {
    return (
      <ul className="pr-list">
        {lines
          .filter((line) => line.trim())
          .map((line, idx) => {
            const item = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
            const checked = /^\[(x|X| )\]\s+/.exec(item);
            const label = checked ? item.replace(/^\[(x|X| )\]\s+/, "") : item;
            return (
              <li key={idx}>
                {checked ? (
                  <span className="mr-2 opacity-60">{checked[1] === " " ? "☐" : "☑"}</span>
                ) : null}
                {renderInline(label, owner, repo)}
              </li>
            );
          })}
      </ul>
    );
  }

  return <p>{renderInline(text, owner, repo)}</p>;
}

export function PrBody({
  text,
  owner,
  repo,
}: {
  text: string;
  owner?: string;
  repo?: string;
}) {
  if (!text.trim()) {
    return <p className="text-[var(--muted)]">No description provided.</p>;
  }

  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="pr-body">
      {blocks.map((block, i) => (
        <Block key={i} text={block} owner={owner} repo={repo} />
      ))}
    </div>
  );
}
