export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getOrientation?: () => [number, number, number, number] | null;
  getFiring?: () => boolean;
  setKeys?: (codes: string[]) => void;
  setSteer?: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
