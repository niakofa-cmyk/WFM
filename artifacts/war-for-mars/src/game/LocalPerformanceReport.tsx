import { useState } from "react";
import type { LocalPerformanceDeviceInfo, LocalPerformanceSummary } from "./local-performance";

export function LocalPerformanceReport({
  device,
  summary,
  capturedAt,
}: {
  device: LocalPerformanceDeviceInfo;
  summary: LocalPerformanceSummary;
  capturedAt: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const report = JSON.stringify({
    title: "Local no-reward Solo Flight performance sample",
    capturedAt,
    device,
    summary,
  }, null, 2);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied. It has not been sent to the server.");
    } catch {
      setCopyStatus("Clipboard unavailable. Select and copy the report text above.");
    }
  };

  return (
    <section
      aria-label="Local performance report"
      className="mt-6 border border-solar/50 bg-void/80 p-4"
      data-testid="local-performance-report"
    >
      <h2 className="mt-0">Local performance sample</h2>
      <p className="text-sm leading-relaxed text-bone/80">
        This report stays in this browser and is not uploaded. The target counts active game seconds in one local run.
        Active-play and result-screen frame cadence are separate; frame intervals estimate browser cadence, not GPU timing.
        Temperature is not exposed to the page; record any device warning separately.
      </p>
      {summary.targetReached === false && summary.targetGameSeconds !== null && (
        <p className="border border-alert/70 bg-alert/10 p-3 text-sm" role="alert" data-testid="performance-target-warning">
          This run recorded {summary.activeGameSeconds.toFixed(1)} of {summary.targetGameSeconds} active game seconds.
          It ended before the selected target, so this is partial performance evidence.
        </p>
      )}
      <p className="text-sm leading-relaxed text-bone/80" data-testid="performance-phase-summary">
        Active play: {summary.activeGameSeconds.toFixed(1)} game seconds in one local run ({summary.roundsCompleted} natural result
        {summary.roundsCompleted === 1 ? "" : "s"}). Visible frame time: {summary.activeFrameSeconds.toFixed(1)} seconds active,
        {` ${summary.postMatchFrameSeconds.toFixed(1)} `}seconds on result screens, and {summary.nonSampledWallSeconds.toFixed(1)} seconds outside sampled frames.
      </p>
      <pre
        aria-label="Performance report data"
        className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-bone/20 bg-black/30 p-3 text-xs leading-relaxed"
        data-testid="local-performance-report-data"
      >{report}</pre>
      <button
        className="sf-btn"
        data-testid="button-copy-performance-report"
        onClick={() => void copyReport()}
        type="button"
      >
        Copy report
      </button>
      <p aria-live="polite" className="text-sm" data-testid="text-performance-copy-status">
        {copyStatus}
      </p>
    </section>
  );
}
