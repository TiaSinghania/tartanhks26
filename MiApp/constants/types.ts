export interface Peer {
  peerId: string;
  peerName: string;
  rssi?: number;
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
  rssi?: number;
}

// RSSI-related types for crowd crush detection
export interface RSSISnapshot {
  peerId: string;
  rssi: number;
  timestamp: number;
}

export interface PeerRSSIHistory {
  peerId: string;
  rssiHistory: RSSISnapshot[];
  closingIn: boolean; // True if moving closer (RSSI improving)
}

export interface CrowdCrushAlert {
  detected: boolean;
  severity: 'low' | 'medium' | 'high';
  closestPeers: number; // Number of people detected moving toward you
  totalNearby: number;
  message: string;
}

// Define Props for your components
export interface HostRoomProps {
  eventCode: string | null;
  eventName: string | null;
  onExit: () => void;
}


// Define Props for your components
export interface JoinRoomProps {
  onExit: () => void;
}

