import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGlobalCampaign,
  useClaimGlobalCampaignFinale,
  getGetGlobalCampaignQueryKey,
} from "@workspace/api-client-react";

const PHASE_LABEL: Record<string, string> = {
  INITIAL_CONTACT: "INITIAL CONTACT",
  BEACON_RECON: "BEACON RECON",
  WARDEN_INTERCEPT: "WARDEN INTERCEPT",
  CAGE_CLIMAX: "CAGE CLIMAX",
  SYSTEM_VICTORY: "SYSTEM VICTORY",
};

export function GlobalCampaignStatus() {
  const queryClient = useQueryClient();
  const campaign = useGetGlobalCampaign({
    query: { queryKey: getGetGlobalCampaignQueryKey(), refetchInterval: 5000, refetchOnWindowFocus: true },
  });
  const claim = useClaimGlobalCampaignFinale({
    mutation: {
      onSettled: () => queryClient.invalidateQueries({ queryKey: getGetGlobalCampaignQueryKey() }),
    },
  });
  const wasEnabled = useRef(false);
  const [, force] = useState(0);
  const [campaignMenuHost, setCampaignMenuHost] = useState<HTMLElement | null>(null);
  const data = campaign.data;

  useEffect(() => {
    const syncMenuHost = () => {
      const arena = document.querySelector('[data-testid="arena-stage"]');
      const host = arena?.querySelector('[data-testid="campaign-status-slot"]') ?? null;
      setCampaignMenuHost((current) => current === host ? current : host as HTMLElement | null);
    };
    syncMenuHost();
    const observer = new MutationObserver(syncMenuHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (data?.enabled && !wasEnabled.current) {
      wasEnabled.current = true;
      force((n) => n + 1);
    }
  }, [data?.enabled]);

  // Error with no trusted data: show only if the campaign was previously confirmed enabled.
  if (campaign.isError && (!data || !data.enabled)) {
    if (!wasEnabled.current) return null;
    if (campaignMenuHost) {
      return createPortal(
        <p data-testid="status-campaign-unavailable" role="status" className="campaign-menu-status font-hud text-[9px] tracking-[0.2em] text-alert">
          SHARED CAMPAIGN · LINK UNAVAILABLE
        </p>,
        campaignMenuHost,
      );
    }
    return (
      <div className="pointer-events-none fixed left-1/2 top-2 z-[60] -translate-x-1/2 font-hud">
        <p data-testid="status-campaign-unavailable" role="status" className="border border-alert/50 bg-void/80 px-2 py-0.5 text-[9px] tracking-[0.2em] text-alert">
          SHARED CAMPAIGN · LINK UNAVAILABLE
        </p>
      </div>
    );
  }
  if (!data || !data.enabled) return null;

  if (data.concluded) {
    const receipt = claim.data;
    const recorded = !!receipt || data.finaleClaimed;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/95 p-4 font-hud text-bone" data-testid="panel-campaign-finale" role="dialog" aria-modal="true" aria-labelledby="campaign-finale-title">
        <div className="w-full max-w-md border border-solar/40 bg-void/90 p-6 text-center">
          <p className="text-[10px] tracking-[0.3em] text-spectral">SHARED CAMPAIGN · {PHASE_LABEL[data.phase] ?? data.phase}</p>
          <h2 id="campaign-finale-title" className="mt-2 text-3xl tracking-[0.15em] text-solar">CAMPAIGN COMPLETE</h2>
          <p className="mt-2 text-[11px] tracking-wide text-muted">
            The mission has ended. {data.completedOperations}/{data.targetOperations} operations confirmed by all pilots.
          </p>

          {receipt ? (
            <div data-testid="receipt-campaign-finale" className="mt-5 border-t border-bone/10 pt-4 text-left text-[11px] tracking-wide">
              <p className="mb-2 text-[9px] tracking-[0.2em] text-spectral">{receipt.replayed ? "REWARD ALREADY RECORDED" : "SERVER RECEIPT"}</p>
              <Row k="CREDITS" v={`+${receipt.credits.toLocaleString()} CR`} id="credits" />
              <Row k="CAMPAIGN XP" v={`+${receipt.campaignXp.toLocaleString()}`} id="xp" />
              <Row k="BADGE" v={receipt.badge} id="badge" />
              <Row k="SHIELD MK2" v={receipt.shieldMk2 ? "UNLOCKED" : "NOT GRANTED"} id="shield" />
              <p className="mt-2 text-[9px] text-muted">Campaign XP is a campaign record, separate from pilot level.</p>
            </div>
          ) : recorded ? (
            <p data-testid="text-finale-recorded" className="mt-5 border border-solar/30 px-3 py-2 text-[11px] tracking-wide text-solar">
              Your finale reward is already recorded on this account.
            </p>
          ) : data.finaleEligible ? (
            <div className="mt-5">
              <button
                type="button"
                data-testid="button-claim-finale"
                disabled={claim.isPending}
                onClick={() => claim.mutate()}
                className="w-full border border-solar bg-solar/15 px-4 py-2 text-xs tracking-[0.25em] text-solar hover:bg-solar/25 disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-solar"
              >
                {claim.isPending ? "CONFIRMING WITH COMMAND…" : "CLAIM FINALE REWARD"}
              </button>
              {claim.isError ? (
                <p data-testid="text-claim-error" role="alert" className="mt-2 text-[10px] text-alert">
                  Claim response not confirmed. Refresh or retry safely; the server will not grant it twice.
                </p>
              ) : null}
            </div>
          ) : (
            <p data-testid="text-finale-ineligible" className="mt-5 border border-bone/15 px-3 py-2 text-[11px] leading-snug text-muted">
              This campaign ended before you joined. No finale rewards are available, and new participation is closed.
            </p>
          )}
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, data.progressPercent));
  if (campaignMenuHost) {
    return createPortal(
      <div className="campaign-menu-status flex flex-wrap items-center justify-center gap-2 font-hud text-[9px] tracking-[0.16em] text-bone" data-testid="status-global-campaign" role="status" aria-live="polite">
        <span className="text-spectral">SHARED CAMPAIGN</span>
        <span className="text-solar">{pct.toFixed(1)}%</span>
        <span className="text-muted">{PHASE_LABEL[data.phase] ?? data.phase}</span>
        {campaign.isError ? <span className="text-alert">· STALE</span> : null}
      </div>,
      campaignMenuHost,
    );
  }
  return (
    <div className="pointer-events-none fixed left-1/2 top-2 z-[60] -translate-x-1/2 font-hud" data-testid="status-global-campaign" role="status" aria-live="polite">
      <div className="flex items-center gap-2 border border-solar/30 bg-void/75 px-2 py-0.5 text-[9px] tracking-[0.2em] text-bone">
        <span className="text-spectral">SHARED CAMPAIGN</span>
        <span className="relative h-1 w-16 bg-bone/10">
          <span className="absolute inset-y-0 left-0 bg-solar" style={{ width: `${pct}%` }} />
        </span>
        <span data-testid="text-campaign-percent" className="text-solar">{pct.toFixed(1)}%</span>
        <span data-testid="text-campaign-phase" className="text-muted">{PHASE_LABEL[data.phase] ?? data.phase}</span>
        {campaign.isError ? <span className="text-alert">· STALE</span> : null}
      </div>
    </div>
  );
}

function Row({ k, v, id }: { k: string; v: string; id: string }) {
  return (
    <div className="flex justify-between border-b border-bone/5 py-1">
      <span className="text-muted">{k}</span>
      <span data-testid={`text-finale-${id}`} className="text-bone">{v}</span>
    </div>
  );
}

export default GlobalCampaignStatus;
