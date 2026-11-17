/** Fixed, versioned celestial references in server simulation metres.
 * Rendering adds its presentation Y offset; neither body follows a viewer.
 * Preserve these existing coordinates: changing them requires world migration.
 */
export const UNIVERSE_REFERENCE_FRAME_ID = "mars-orbital-fixed-v1";
export const UNIVERSE_MARS_REFERENCE = {
  id: "mars", position: { x: -100, y: 20.1, z: -200 }, radius: 65,
} as const;
export const UNIVERSE_MOON_REFERENCE = {
  id: "orbital-moon", position: { x: 100, y: 49.1, z: -210 }, radius: 7,
} as const;
