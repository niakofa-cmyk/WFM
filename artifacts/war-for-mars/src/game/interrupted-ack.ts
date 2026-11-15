type InterruptedAckSocket = {
  readyState: number;
  send(data: string): void;
  close(): void;
};

export function acknowledgeInterruptedNotice(socket: InterruptedAckSocket): boolean {
  // WebSocket.OPEN is the stable protocol value 1; keeping this helper DOM-runtime-free
  // lets the acknowledgement behavior be covered by the Node test suite.
  if (socket.readyState !== 1) return false;
  try {
    socket.send(JSON.stringify({ type: "interrupted_ack" }));
    return true;
  } catch {
    socket.close();
    return false;
  }
}
