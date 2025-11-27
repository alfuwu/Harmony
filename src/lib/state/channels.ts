import { createSignal } from "solid-js";
import { Channel } from "../utils/types";

const [currentChannel, setCurrentChannel] = createSignal<number | null>(null);
const [channels, setChannels] = createSignal<Channel[]>([]);

export const channelState = { currentChannel, setCurrentChannel, channels, setChannels };
