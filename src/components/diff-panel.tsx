function lineKind(line: string) {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
    return "meta";
  }
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "ctx";
}

export function DiffPanel({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return (
      <div className="diff-empty">This pull request has an empty diff.</div>
    );
  }

  const lines = diff.replace(/\r\n/g, "\n").split("\n");

  return (
    <div className="diff-panel" tabIndex={0}>
      <pre>
        {lines.map((line, i) => (
          <div key={i} className={`diff-line diff-${lineKind(line)}`}>
            <span className="diff-gutter">{i + 1}</span>
            <span className="diff-code">{line.length ? line : " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
