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

// --- Location Types ---

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

// GPS Anchor: user who has opted into location sharing
export interface GPSAnchorMessage {
  type: 'GPS_ANCHOR';
  peerId: string;
  peerName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

// Proximity Reading: estimated distance to an anchor based on connectivity
export interface ProximityReading {
  targetPeerId: string;
  estimatedDistance: number; // meters - estimated based on being connected
}

// Proximity Report: distance estimates to anchors
export interface ProximityReportMessage {
  type: 'PROXIMITY_REPORT';
  peerId: string;
  peerName: string;
  readings: ProximityReading[];
  timestamp: string;
}

// Legacy RSSI types (kept for compatibility, may be removed later)
export interface RSSIReading {
  targetPeerId: string;
  rssi: number;
  timestamp: string;
}

export interface RSSIReportMessage {
  type: 'RSSI_REPORT';
  peerId: string;
  peerName: string;
  readings: RSSIReading[];
}

// Combined user position (either from GPS or triangulated)
export interface UserPosition {
  peerId: string;
  peerName: string;
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  source: 'gps' | 'triangulated' | 'estimated-1' | 'estimated-2';
  isAnchor: boolean; // true if sharing GPS
  lastUpdate: string;
  // For 1-anchor estimation: show as ring around anchor
  anchorDistance?: number; // distance from anchor in meters
  anchorLat?: number;
  anchorLng?: number;
  // For 2-anchor estimation: store both anchor refs
  anchor2Lat?: number;
  anchor2Lng?: number;
  anchor2Distance?: number;
}

export type LocationMessage = GPSAnchorMessage | ProximityReportMessage;

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

