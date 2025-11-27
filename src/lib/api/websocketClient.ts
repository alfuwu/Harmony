let socket: WebSocket | null = null;

export function initWebSocket() {
  socket = new WebSocket("wss://localhost:7127/ws");

  socket.onopen = () => console.log("WS connected");
  socket.onmessage = (e) => console.log("WS message:", e.data);
  socket.onclose = () => console.log("WS closed");
}
