/** Skeleton shown while a page's data loads. Mirrors the masthead-and-rows shape of every page. */
export default function Loading() {
  return (
    <div className="masthead-rule" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div aria-hidden className="animate-pulse">
        <div className="h-3 w-28 bg-paper-sunk" />
        <div className="mt-3 h-9 w-48 bg-paper-sunk" />
        <div className="mt-8 h-40 bg-paper-sunk" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mt-4 h-12 border-b border-rule">
            <div className="h-4 w-2/3 bg-paper-sunk" />
          </div>
        ))}
      </div>
    </div>
  );
}
