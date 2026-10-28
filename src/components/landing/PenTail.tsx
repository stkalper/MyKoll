/**
 * Handwriting the scrolling pen finishes: the last few letters are a stop on the pen's
 * route, and it writes them in as it passes. They stay visible when the pen isn't shown
 * (small screens, reduced motion), since only the pen hides them.
 */
export function PenTail({ text, letters = 6 }: { text: string; letters?: number }) {
  const chars = Array.from(text);
  const cut = Math.max(0, chars.length - letters);
  return (
    <>
      {chars.slice(0, cut).join("")}
      <span data-pen data-pen-write>
        {chars.slice(cut).map((c, i) => (
          <span key={i} data-pen-letter>
            {c}
          </span>
        ))}
      </span>
    </>
  );
}
