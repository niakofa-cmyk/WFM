export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getFiring?: () => boolean;
  setKeys?: (codes: string[]) => void;
  setSteer?: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
