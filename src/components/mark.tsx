export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect width="40" height="40" rx="12" fill="#12202f" />
      <rect x="8" y="9" width="10" height="22" rx="3" fill="#7ee0c4" />
      <rect x="22" y="9" width="10" height="22" rx="3" fill="#c9d6f2" />
      <path d="M10.5 20h5" stroke="#12202f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24.5 16h5M24.5 24h5" stroke="#12202f" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
