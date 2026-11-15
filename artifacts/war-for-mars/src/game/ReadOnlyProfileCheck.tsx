import { useState } from "react";
import { readLocalPerformanceDeviceInfo } from "./local-performance";
import { loadServerProfile } from "./progression-api";
import type { Save } from "./save";
import {
  createReadOnlyProfileCheckReport,
  displayedProfileMatchesServer,
  readHttpStatus,
} from "./read-only-profile-check";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || null;

export function ReadOnlyProfileCheck({
  save,
  signedIn,
}: {
  save: Save;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const runCheck = async () => {
    if (busy || !signedIn) return;
    setBusy(true);
    setCopyStatus("");
    const startedAt = performance.now();
    let reportData;
    try {
      const profile = await loadServerProfile();
      reportData = createReadOnlyProfileCheckReport({
        capturedAt: new Date().toISOString(),
        pageOrigin: window.location.origin,
        apiBaseUrl,
        device: readLocalPerformanceDeviceInfo(),
        signedIn,
        outcome: "success",
        httpStatus: null,
        responseTimeMs: performance.now() - startedAt,
        visibleProfileFieldsMatchServer: displayedProfileMatchesServer(profile, save),
      });
    } catch (error) {
      reportData = createReadOnlyProfileCheckReport({
        capturedAt: new Date().toISOString(),
        pageOrigin: window.location.origin,
        apiBaseUrl,
        device: readLocalPerformanceDeviceInfo(),
        signedIn,
        outcome: "failure",
        httpStatus: readHttpStatus(error),
        responseTimeMs: performance.now() - startedAt,
        visibleProfileFieldsMatchServer: null,
      });
    } finally {
      setBusy(false);
    }
    setReport(JSON.stringify(reportData, null, 2));
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Read-only report copied. It was not sent to the server.");
    } catch {
      setCopyStatus("Clipboard unavailable. Select and copy the report below.");
    }
  };

  return (
    <section
      aria-label="Read-only live profile check"
      className="mt-5 max-w-sm border border-solar/50 bg-void/70 p-3"
      data-testid="read-only-profile-check"
    >
      <h3 className="font-hud text-lg tracking-widest text-solar">LIVE PROFILE CHECK</h3>
      <p className="my-2 text-sm leading-relaxed text-muted">
        Runs one signed-in, read-only profile request. It sends no reward claim and cannot inspect the reward ledger.
      </p>
      <button
        type="button"
        className="h-11 w-full border border-solar px-3 font-hud tracking-widest text-solar disabled:opacity-50"
        data-testid="button-run-read-only-profile-check"
        disabled={!signedIn || busy}
        onClick={() => void runCheck()}
      >
        {busy ? "CHECKING PROFILE…" : "RUN READ-ONLY CHECK"}
      </button>
      {report ? (
        <>
          <pre
            aria-label="Read-only profile check report"
            className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-bone/20 bg-black/30 p-3 text-xs leading-relaxed"
            data-testid="read-only-profile-check-report"
          >{report}</pre>
          <button
            type="button"
            className="mt-2 h-11 w-full border border-bone/30 px-3 font-hud tracking-widest text-bone"
            data-testid="button-copy-read-only-profile-check"
            onClick={() => void copyReport()}
          >
            COPY REPORT
          </button>
          <p aria-live="polite" className="mt-2 text-sm" data-testid="text-read-only-profile-copy-status">
            {copyStatus}
          </p>
        </>
      ) : null}
    </section>
  );
}
