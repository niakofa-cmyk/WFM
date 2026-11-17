type VisibleViewport = Pick<VisualViewport, "width" | "height" | "offsetLeft" | "offsetTop">;

const positive = (value: number) => Number.isFinite(value) && value > 0;

/** Keep the render surface and its HUD inside the same visible browser rectangle. */
export function flightViewportRect(width: number, height: number, visible?: VisibleViewport | null) {
  const fallbackWidth = positive(width) ? width : 1;
  const fallbackHeight = positive(height) ? height : 1;
  return {
    width: visible && positive(visible.width) ? Math.min(fallbackWidth, visible.width) : fallbackWidth,
    height: visible && positive(visible.height) ? Math.min(fallbackHeight, visible.height) : fallbackHeight,
    left: visible && Number.isFinite(visible.offsetLeft) ? Math.max(0, visible.offsetLeft) : 0,
    top: visible && Number.isFinite(visible.offsetTop) ? Math.max(0, visible.offsetTop) : 0,
  };
}

export function attachFlightViewport(stage: HTMLElement, host: Window = window) {
  const originalStyle = stage.getAttribute("style");
  const originalCompact = stage.dataset.compactViewport;
  const visible = host.visualViewport;
  let pending = 0;
  const update = () => {
    const rect = flightViewportRect(host.innerWidth, host.innerHeight, visible);
    stage.style.position = "fixed";
    for (const name of ["width", "height", "left", "top"] as const) {
      const value = `${rect[name]}px`;
      stage.style[name] = value;
      stage.style.setProperty(`--flight-viewport-${name}`, value);
    }
    stage.dataset.compactViewport = String(rect.width > rect.height && rect.height <= 380);
  };
  const refresh = () => {
    update();
    host.cancelAnimationFrame(pending);
    pending = host.requestAnimationFrame(update);
  };
  const listeners: [EventTarget, string][] = [
    [host, "resize"], [host, "orientationchange"],
    [host.document, "fullscreenchange"],
    ...(visible ? [[visible, "resize"], [visible, "scroll"]] as [EventTarget, string][] : []),
  ];
  for (const [target, event] of listeners) target.addEventListener(event, refresh);
  refresh();
  return () => {
    for (const [target, event] of listeners) target.removeEventListener(event, refresh);
    host.cancelAnimationFrame(pending);
    if (originalStyle === null) stage.removeAttribute("style");
    else stage.setAttribute("style", originalStyle);
    if (originalCompact === undefined) delete stage.dataset.compactViewport;
    else stage.dataset.compactViewport = originalCompact;
  };
}
