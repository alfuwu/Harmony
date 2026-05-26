import * as signalR from "@microsoft/signalr";
import { AuthState } from "../state/Auth";
import { hostUrl } from "../../App";
import { MessageState } from "../state/Messages";
import { ChannelState } from "../state/Channels";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { Presence, VoiceState } from "../utils/types";

export let connection: signalR.HubConnection | null = null;

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

  connection.on("UpdStatus", (p: Presence) => {
    const user = userState.users.find(u => u.id === p.userId);
    if (user) {
      user.onlineStatus = p.onlineStatus;
      user.showStatusWhileOffline = p.showStatusWhileOffline;
      user.status = p.statusText;
      userState.addUser(user);
    }
  });

  connection.on("VoiceState", (_vs: VoiceState) => {});

  connection.on("Typing", channelState.startTyping);
  connection.on("StopTyping", channelState.stopTyping);

  connection.on("DrawStroke", _ => {});
  connection.on("DrawClear", _ => {});

  connection.on("UpdServ", serverState.addServer);
  connection.on("DelServ", serverState.removeServer);

  connection.on("UpdChan", channelState.addChannel);
  connection.on("DelChan", channelState.removeChannel);

  connection.start()
    .then(() => {
      console.log("SignalR connected");
      channelState.channels.forEach(async c => await connection!.invoke("JoinChannel", c.id));
      serverState.servers.forEach(async s => await connection!.invoke("JoinServer", s.id));
    })
    .catch((err: Error) => console.error(err));
}
