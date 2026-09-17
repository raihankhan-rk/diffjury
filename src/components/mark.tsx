/** Git pull-request / branch-merge mark. */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect width="32" height="32" rx="9" fill="#12202f" />
      <circle cx="10.5" cy="9" r="2.7" fill="#7ee0c4" />
      <circle cx="10.5" cy="23" r="2.7" fill="#7ee0c4" />
      <circle cx="22" cy="23" r="2.7" fill="#7ee0c4" />
      <path
        d="M10.5 11.7v8.6M10.5 13.6h7.6c2.2 0 3.9 1.8 3.9 4v2.7"
        stroke="#7ee0c4"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
