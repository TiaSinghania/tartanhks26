export interface Peer {
  peerId: string;
  peerName: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export interface NearbyData {
  peerId: string;
  peerName?: string;
  text?: string;
}

// Define Props for your components
export interface RoomProps {
  onExit: () => void;
}
