import { getGetWorldOperationsQueryKey, useGetWorldOperations } from "@workspace/api-client-react";
import { isOperationDirectoryFresh, selectCinderLiveOperations, useWorldOperationEvents } from "./world-operation-events";

type Props = { onOpenOperations?: () => void };

/** Read-only live signal. The server's operation admission remains in GalaxyScreen. */
export function CinderRingOperationPreview({ onOpenOperations }: Props) {
  const streamState = useWorldOperationEvents();
  const query = useGetWorldOperations({
    query: {
      queryKey: getGetWorldOperationsQueryKey(),
      refetchInterval: streamState === "live" ? false : 30_000,
    },
  });
  const fresh = isOperationDirectoryFresh(query.data);
  const operations = fresh ? selectCinderLiveOperations(query.data) : [];

  return (
    <section
      aria-label="Cinder Ring live operations"
      data-testid="cinder-live-operations"
      className="pointer-events-auto border border-bone/15 bg-void/90 px-3 py-2 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-hud text-[9px] tracking-[0.18em] text-solar">
          CINDER RING · {streamState === "live" ? "LIVE SIGNAL" : streamState === "reconnecting" ? "RECONNECTING" : streamState === "connecting" ? "CONNECTING" : "SIGNAL UNAVAILABLE"}
        </p>
        {onOpenOperations ? (
          <button
            type="button"
            data-testid="button-open-cinder-operations"
            onClick={onOpenOperations}
            className="min-h-9 border border-solar/50 px-2 font-hud text-[9px] tracking-widest text-bone hover:border-solar"
          >
            OPERATIONS
          </button>
        ) : null}
      </div>
      {query.isLoading && !query.data ? (
        <p role="status" className="mt-1 text-[10px] text-muted">Reading public operation signals…</p>
      ) : operations.length ? (
        <ul className="mt-1 space-y-1">
          {operations.slice(0, 2).map((operation) => (
            <li key={operation.id} data-testid={`cinder-live-operation-${operation.id}`} className="text-[10px] leading-snug text-bone/85">
              <span className="font-hud text-solar">{operation.title}</span>
              <span className="ml-2 text-muted">{operation.experience.toUpperCase()} · {operation.currentPlayers}/{operation.capacity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[10px] text-muted">
          {query.isError || streamState === "unavailable"
            ? "Live operation data is unavailable."
            : query.data && !fresh
              ? "The last server snapshot is too old to show matches."
              : "No active public matches reported here."}
        </p>
      )}
    </section>
  );
}
