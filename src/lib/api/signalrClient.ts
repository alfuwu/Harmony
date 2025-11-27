import * as signalR from "@microsoft/signalr";
import { authState } from "../state/auth";

let connection: signalR.HubConnection | null = null;

export function initSignalR() {
  connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:7127/ws", {
      accessTokenFactory: () => authState.token() || ""
    })
    .withAutomaticReconnect()
    .build();

  connection.on("RecvMsg", msg => {
    console.log("received message:", msg);
  });

  connection.start()
    .then(() => console.log("SignalR connected"))
    .catch(err => console.error(err));
}
