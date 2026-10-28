/** Tally marks, the way you'd count on the back of a folder: groups of four with a strike. */
export function Tally({ count, className = "" }: { count: number; className?: string }) {
  const groups = Array.from({ length: Math.ceil(count / 5) }, (_, g) => Math.min(5, count - g * 5));
  return (
    <span className={`inline-flex flex-wrap gap-2 ${className}`} aria-label={`${count}`}>
      {groups.map((n, g) => (
        <svg key={g} width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {Array.from({ length: Math.min(n, 4) }, (_, i) => (
            <path key={i} d={`M${4 + i * 5} ${3 + (i % 2)} L${4 + i * 5 + (i % 2 ? 1 : -1)} 19`} />
          ))}
          {n === 5 && <path d="M1 15 L24 6" />}
        </svg>
      ))}
    </span>
  );
}
