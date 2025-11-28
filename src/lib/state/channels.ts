import { createSignal } from "solid-js";
import { Channel } from "../utils/types";

const [currentChannel, setCurrentChannel] = createSignal<Channel | null>(null);
const [channels, setChannels] = createSignal<Channel[]>([]);

export const channelState = { currentChannel, setCurrentChannel, channels, setChannels };
