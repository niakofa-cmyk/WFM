import type { EconomyRejection } from "@workspace/api-client-react";

export function RejectedEconomyRequests({ rows }: { rows: EconomyRejection[] }) {
  if (!rows.length) return null;
  return <section data-testid="economy-rejections" className="border-t border-alert/30 px-4 py-3">
    <h3 className="font-hud text-sm tracking-widest text-alert">REJECTED REQUESTS</h3>
    <p className="mt-1 text-[10px] text-muted">These attempts did not commit. A later retry may have succeeded; check the confirmed ledger above.</p>
    <ul className="mt-2 space-y-2">
      {rows.map((row) => <li key={row.id} className="break-words text-xs text-bone/80">
        <span className="font-hud uppercase text-alert">{row.action} · {row.targetId}</span>
        <p>{row.reason}</p>
        <time className="text-[10px] text-muted">{new Date(row.createdAt).toLocaleString()}</time>
      </li>)}
    </ul>
  </section>;
}
