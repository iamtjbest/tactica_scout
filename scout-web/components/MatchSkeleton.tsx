export default function MatchSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 w-32 rounded bg-sur2" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-sur2" />
              <div className="h-3.5 w-36 rounded bg-sur2" />
            </div>
            <div className="h-5 w-6 rounded bg-sur2" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-sur2" />
              <div className="h-3.5 w-28 rounded bg-sur2" />
            </div>
            <div className="h-5 w-6 rounded bg-sur2" />
          </div>
        </div>
      ))}
    </div>
  );
}
