export const MenuState = {
  BOOT: "BOOT",
  TITLE: "TITLE",
  MAIN_MENU: "MAIN_MENU",
  ARMORY: "ARMORY",
  SETTINGS: "SETTINGS",
  HANGAR: "HANGAR",
  LOADING: "LOADING",
  GAMEPLAY: "GAMEPLAY",
} as const;

export type MenuStateId = (typeof MenuState)[keyof typeof MenuState];

export type MenuAction =
  | "BOOT_DONE"
  | "START"
  | "DEPLOY"
  | "ARCADE"
  | "ARMORY"
  | "SETTINGS"
  | "BACK"
  | "LAUNCH"
  | "LOADED";

const TIPS = [
  "The fleet that took Eon Dusk to Mars did not come back.",
  "Hold two relays, or the wing bar breaks first.",
  "A cloak hides a gun solution. It does not hide a ram.",
  "Strike is six minutes. Practice is the drill.",
];

export function menuTip(index: number) {
  return TIPS[Math.abs(index) % TIPS.length];
}

export function nextMenu(state: MenuStateId, action: MenuAction): MenuStateId {
  switch (state) {
    case MenuState.BOOT:
      return action === "BOOT_DONE" || action === "START" ? MenuState.TITLE : state;
    case MenuState.TITLE:
      return action === "START" ? MenuState.MAIN_MENU : state;
    case MenuState.MAIN_MENU:
      if (action === "DEPLOY" || action === "ARCADE") return MenuState.HANGAR;
      if (action === "ARMORY") return MenuState.ARMORY;
      if (action === "SETTINGS") return MenuState.SETTINGS;
      return state;
    case MenuState.ARMORY:
    case MenuState.SETTINGS:
      return action === "BACK" ? MenuState.MAIN_MENU : state;
    case MenuState.HANGAR:
      if (action === "BACK") return MenuState.MAIN_MENU;
      if (action === "LAUNCH") return MenuState.LOADING;
      return state;
    case MenuState.LOADING:
      return action === "LOADED" ? MenuState.GAMEPLAY : state;
    case MenuState.GAMEPLAY:
      return action === "BACK" ? MenuState.HANGAR : state;
    default:
      return state;
  }
}
