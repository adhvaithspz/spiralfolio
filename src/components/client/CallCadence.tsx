/**
 * Tiny sparkline rendered as colored bars showing call frequency over the
 * last N weeks (oldest → newest, left → right). Empty weeks render as a faint dot.
 */
export function CallCadence({ buckets, weeks = 12 }: { buckets: number[]; weeks?: number }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="flex items-end gap-[2px]" aria-label={`Calls over last ${weeks} weeks`}>
      {buckets.map((count, i) => {
        if (count === 0) {
          return <span key={i} className="block h-1 w-1 rounded-full bg-border-strong" />;
        }
        const h = 4 + Math.round((count / max) * 14);
        const isLatest = i === buckets.length - 1;
        return (
          <span
            key={i}
            className={`block w-1 rounded-sm ${isLatest ? 'bg-accent' : 'bg-text-dim'}`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}
