import * as signalR from "@microsoft/signalr";
import { AuthState } from "../state/Auth";
import { hostUrl } from "../../App";
import { MessageState } from "../state/Messages";
import { ChannelState } from "../state/Channels";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";

let connection: signalR.HubConnection | null = null;

export function initSignalR({
  authState,
  serverState,
  channelState,
  messageState,
  userState
}: {
  authState: AuthState;
  serverState: ServerState;
  channelState: ChannelState;
  messageState: MessageState;
  userState: UserState;
}) {
  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hostUrl}/gateway`, {
      accessTokenFactory: () => authState.token || ""
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.None)
    .build();

  connection.on("RecvMsg", messageState.addMessage);
  connection.on("DelMsg", messageState.removeMessage);
  
  connection.on("UpdUsr", u => { userState.addUser(u); console.log("USER UPDATE: ", u); });
  connection.on("UpdMem", userState.addMember);

  connection.on("UpdServ", serverState.addServer);
  connection.on("DelServ", serverState.removeServer);

  connection.on("UpdChan", channelState.addChannel);
  connection.on("DelChan", channelState.removeChannel);

  connection.start()
    .then(() => console.log("SignalR connected"))
    .catch((err: Error) => console.error(err));
}
