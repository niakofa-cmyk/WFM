import {
  getGetPublicWingLeaderboardQueryKey,
  useGetPublicWingLeaderboard,
} from "@workspace/api-client-react";

export function PublicWingLeaderboard() {
  const query = useGetPublicWingLeaderboard({
    query: {
      queryKey: getGetPublicWingLeaderboardQueryKey(),
      refetchOnWindowFocus: true,
    },
  });
  const entries = query.data?.entries ?? [];

  return (
    <section
      aria-labelledby="public-wing-leaderboard-title"
      className="mt-6 border border-solar/30 bg-void/55 p-4"
      data-testid="public-wing-leaderboard"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="public-wing-leaderboard-title" className="font-hud text-xl tracking-widest text-solar">
            WING LEADERBOARD
          </h2>
          <p className="mt-1 text-xs text-muted">All-time server-verified Wing credits · opt-in pilots only</p>
        </div>
        {query.isFetching ? <span className="text-xs text-muted" role="status">UPDATING</span> : null}
      </div>

      {query.isError ? (
        <div className="mt-3 border border-alert/40 p-3">
          <p role="alert" className="text-sm text-bone">Leaderboard is temporarily unavailable.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 h-9 border border-bone/30 px-3 font-hud tracking-widest text-bone"
          >
            RETRY
          </button>
        </div>
      ) : query.isLoading ? (
        <p className="mt-3 text-sm text-muted" role="status">Loading standings…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 border border-dashed border-bone/15 px-3 py-4 text-sm text-muted">
          No pilots have opted in yet. Opt in from Settings after signing in.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-bone/10" aria-label="Opt-in Wing standings">
          {entries.map((entry) => (
            <li
              key={`${entry.rank}-${entry.callsign}`}
              className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 py-2"
              data-testid="leaderboard-entry"
            >
              <span className="font-hud text-sm text-muted">#{entry.rank}</span>
              <span className="truncate font-hud tracking-widest text-bone">{entry.callsign}</span>
              <span className="font-hud text-solar">{entry.score.toLocaleString()} CR</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 border-t border-bone/10 pt-3 text-[11px] leading-relaxed text-muted">
        No emails, account IDs, personal ledger entries, or live-online indicators are shown.
      </p>
    </section>
  );
}
