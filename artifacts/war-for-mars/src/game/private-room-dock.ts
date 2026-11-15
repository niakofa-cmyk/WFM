const ROOM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,23}$/;

export function privateRoomDockAccess(atCinderRing: boolean, roomCode: string) {
  const normalizedCode = roomCode.trim().toUpperCase();
  return {
    canCreate: atCinderRing,
    canJoin: atCinderRing && ROOM_CODE_PATTERN.test(normalizedCode),
  };
}
