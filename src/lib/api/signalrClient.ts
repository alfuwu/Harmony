import * as signalR from "@microsoft/signalr";
import { useAuthState } from "../state/Auth";

let connection: signalR.HubConnection | null = null;

export function initSignalR() {
  connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:7127/ws", {
      accessTokenFactory: () => useAuthState().token || ""
    })
    .withAutomaticReconnect()
    .build();

  connection.on("RecvMsg", msg => {
    console.log("received message:", msg);
  });

  connection.start()
    .then(() => console.log("SignalR connected"))
    .catch((err: Error) => console.error(err));
}
