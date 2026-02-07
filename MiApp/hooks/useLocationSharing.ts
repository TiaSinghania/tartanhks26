import { useState, useEffect, useCallback } from 'react';
import * as NearbyConnections from 'expo-nearby-connections';
import { 
  GPSLocation, 
  GPSAnchorMessage, 
  ProximityReportMessage, 
  ProximityReading,
  UserPosition,
  LocationMessage 
} from '../constants/types';
import { useLocation } from './useLocation';

// Since we're using connection-based proximity, we estimate distance
// based on the fact that expo-nearby-connections works within ~100m
// We assign a default estimated distance for connected peers
const DEFAULT_PROXIMITY_DISTANCE = 25; // meters - reasonable estimate for event attendees

// Circle intersection for 2-anchor estimation
// Returns one of the two intersection points of two circles
function circleIntersection(
  c1: { lat: number; lng: number; distance: number },
  c2: { lat: number; lng: number; distance: number },
  peerId: string // Used to consistently pick same intersection point
): { latitude: number; longitude: number } | null {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(c1.lat * Math.PI / 180);
  
  // Convert to local coordinates
  const x1 = 0;
  const y1 = 0;
  const x2 = (c2.lng - c1.lng) * metersPerDegreeLng;
  const y2 = (c2.lat - c1.lat) * metersPerDegreeLat;
  const r1 = c1.distance;
  const r2 = c2.distance;
  
  const d = Math.sqrt(x2 * x2 + y2 * y2);
  
  // Check if circles intersect
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
    // No intersection - place on line between anchors
    const ratio = r1 / (r1 + r2);
    return {
      latitude: c1.lat + (c2.lat - c1.lat) * ratio,
      longitude: c1.lng + (c2.lng - c1.lng) * ratio,
    };
  }
  
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  
  // Point on line between centers
  const px = x1 + a * (x2 - x1) / d;
  const py = y1 + a * (y2 - y1) / d;
  
  // Use peer ID to consistently choose one of the two intersection points
  const sign = peerId.charCodeAt(0) % 2 === 0 ? 1 : -1;
  
  const ix = px + sign * h * (y2 - y1) / d;
  const iy = py - sign * h * (x2 - x1) / d;
  
  return {
    latitude: c1.lat + iy / metersPerDegreeLat,
    longitude: c1.lng + ix / metersPerDegreeLng,
  };
}

// Trilateration: estimate position from 3+ anchor points with known distances
function trilaterate(
  anchors: Array<{ lat: number; lng: number; distance: number }>
): { latitude: number; longitude: number; accuracy: number } | null {
  if (anchors.length < 3) return null;

  // Use first 3 anchors for basic trilateration
  // Convert lat/lng to local meters (approximate)
  const refLat = anchors[0].lat;
  const refLng = anchors[0].lng;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(refLat * Math.PI / 180);

  // Convert anchors to local coordinates (meters from reference)
  const points = anchors.slice(0, 3).map(a => ({
    x: (a.lng - refLng) * metersPerDegreeLng,
    y: (a.lat - refLat) * metersPerDegreeLat,
    r: a.distance,
  }));

  const [p1, p2, p3] = points;

  // Trilateration formula
  const A = 2 * p2.x - 2 * p1.x;
  const B = 2 * p2.y - 2 * p1.y;
  const C = p1.r ** 2 - p2.r ** 2 - p1.x ** 2 + p2.x ** 2 - p1.y ** 2 + p2.y ** 2;
  const D = 2 * p3.x - 2 * p2.x;
  const E = 2 * p3.y - 2 * p2.y;
  const F = p2.r ** 2 - p3.r ** 2 - p2.x ** 2 + p3.x ** 2 - p2.y ** 2 + p3.y ** 2;

  const denominator = A * E - B * D;
  if (Math.abs(denominator) < 0.0001) return null; // Points are collinear

  const x = (C * E - F * B) / denominator;
  const y = (A * F - C * D) / denominator;

  // Convert back to lat/lng
  const latitude = refLat + y / metersPerDegreeLat;
  const longitude = refLng + x / metersPerDegreeLng;

  // Estimate accuracy based on RSSI noise (rough approximation)
  const avgDistance = anchors.reduce((sum, a) => sum + a.distance, 0) / anchors.length;
  const accuracy = avgDistance * 0.3; // ~30% of average distance

  return { latitude, longitude, accuracy };
}

export interface UseLocationSharingResult {
  // My state
  isParticipating: boolean;      // Show me on map (via proximity)
  isSharingGPS: boolean;         // Share my exact GPS location (become anchor)
  myLocation: GPSLocation | null;
  
  // All users' positions
  userPositions: Map<string, UserPosition>;
  
  // Actions
  startParticipating: () => void;       // Opt-in to show on map
  stopParticipating: () => void;        // Opt-out from map
  startSharingGPS: () => Promise<void>; // Share GPS (become anchor)
  stopSharingGPS: () => void;           // Stop sharing GPS
  
  // For sending data to peers
  getMyAnchorMessage: () => GPSAnchorMessage | null;
}

export function useLocationSharing(
  myPeerId: string,
  myName: string,
  connectedPeerIds: string[]
): UseLocationSharingResult {
  const { location, startTracking, stopTracking, getCurrentLocation } = useLocation();
  
  const [isParticipating, setIsParticipating] = useState(false);  // Show on map
  const [isSharingGPS, setIsSharingGPS] = useState(false);        // GPS anchor
  const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
  const [anchors, setAnchors] = useState<Map<string, GPSAnchorMessage>>(new Map());
  const [proximityReports, setProximityReports] = useState<Map<string, ProximityReportMessage>>(new Map());

  // Listen for incoming location messages
  useEffect(() => {
    const listener = NearbyConnections.onTextReceived((data: NearbyConnections.TextReceived) => {
      try {
        const parsed = JSON.parse(data.text);
        
        if (parsed.type === 'GPS_ANCHOR') {
          const msg = parsed as GPSAnchorMessage;
          setAnchors(prev => new Map(prev).set(msg.peerId, msg));
        } else if (parsed.type === 'PROXIMITY_REPORT') {
          const msg = parsed as ProximityReportMessage;
          setProximityReports(prev => new Map(prev).set(msg.peerId, msg));
        }
      } catch {
        // Not a location message, ignore
      }
    });

    return () => listener();
  }, []);

  // Update user positions when anchors or proximity reports change
  useEffect(() => {
    const newPositions = new Map<string, UserPosition>();

    // Add all GPS anchors as known positions
    anchors.forEach((anchor, peerId) => {
      newPositions.set(peerId, {
        peerId: anchor.peerId,
        peerName: anchor.peerName,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        accuracy: anchor.accuracy,
        source: 'gps',
        isAnchor: true,
        lastUpdate: anchor.timestamp,
      });
    });

    // Add myself if I'm sharing GPS
    if (isSharingGPS && location) {
      newPositions.set(myPeerId, {
        peerId: myPeerId,
        peerName: myName,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        source: 'gps',
        isAnchor: true,
        lastUpdate: location.timestamp,
      });
    }

    // Try to triangulate non-anchor users from proximity reports
    proximityReports.forEach((report, reporterId) => {
      // Skip if this user is already an anchor
      if (anchors.has(reporterId)) return;
      // Skip if this is me and I'm sharing GPS
      if (reporterId === myPeerId && isSharingGPS) return;

      // Find anchors that this user is connected to
      const visibleAnchors: Array<{ lat: number; lng: number; distance: number }> = [];
      
      report.readings.forEach(reading => {
        const anchor = anchors.get(reading.targetPeerId);
        if (anchor) {
          visibleAnchors.push({
            lat: anchor.latitude,
            lng: anchor.longitude,
            distance: reading.estimatedDistance,
          });
        }
      });

      // If we have 3+ anchors, triangulate
      if (visibleAnchors.length >= 3) {
        const estimated = trilaterate(visibleAnchors);
        if (estimated) {
          newPositions.set(reporterId, {
            peerId: report.peerId,
            peerName: report.peerName,
            latitude: estimated.latitude,
            longitude: estimated.longitude,
            accuracy: estimated.accuracy,
            source: 'triangulated',
            isAnchor: false,
            lastUpdate: new Date().toISOString(),
          });
        }
      } else if (visibleAnchors.length === 2) {
        // With 2 anchors: estimate position at intersection of two circles
        // Pick one of the two intersection points (use peer ID to be consistent)
        const [a1, a2] = visibleAnchors;
        const intersection = circleIntersection(a1, a2, report.peerId);
        
        if (intersection) {
          newPositions.set(reporterId, {
            peerId: report.peerId,
            peerName: report.peerName,
            latitude: intersection.latitude,
            longitude: intersection.longitude,
            accuracy: Math.max(a1.distance, a2.distance) * 0.4,
            source: 'estimated-2',
            isAnchor: false,
            lastUpdate: new Date().toISOString(),
            // Store anchor info for visualization
            anchorLat: a1.lat,
            anchorLng: a1.lng,
            anchorDistance: a1.distance,
            anchor2Lat: a2.lat,
            anchor2Lng: a2.lng,
            anchor2Distance: a2.distance,
          });
        }
      } else if (visibleAnchors.length === 1) {
        // With 1 anchor: place on a ring around the anchor
        // Use peer ID to get a consistent angle
        const anchor = visibleAnchors[0];
        const angle = (report.peerId.charCodeAt(0) / 255) * 2 * Math.PI;
        const distance = anchor.distance;
        const offsetLat = (distance / 111320) * Math.cos(angle);
        const offsetLng = (distance / (111320 * Math.cos(anchor.lat * Math.PI / 180))) * Math.sin(angle);
        
        newPositions.set(reporterId, {
          peerId: report.peerId,
          peerName: report.peerName,
          latitude: anchor.lat + offsetLat,
          longitude: anchor.lng + offsetLng,
          accuracy: distance * 0.5,
          source: 'estimated-1',
          isAnchor: false,
          lastUpdate: new Date().toISOString(),
          // Store anchor info for ring visualization
          anchorLat: anchor.lat,
          anchorLng: anchor.lng,
          anchorDistance: distance,
        });
      }
    });

    setUserPositions(newPositions);
  }, [anchors, proximityReports, isSharingGPS, location, myPeerId, myName]);

  // Broadcast my location as anchor when sharing GPS
  useEffect(() => {
    if (!isSharingGPS || !location) return;

    const broadcastLocation = async () => {
      const message: GPSAnchorMessage = {
        type: 'GPS_ANCHOR',
        peerId: myPeerId,
        peerName: myName,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
      };

      for (const peerId of connectedPeerIds) {
        try {
          await NearbyConnections.sendText(peerId, JSON.stringify(message));
        } catch (err) {
          console.error('Failed to broadcast location:', err);
        }
      }
    };

    broadcastLocation();
    const interval = setInterval(broadcastLocation, 5000);
    return () => clearInterval(interval);
  }, [isSharingGPS, location, myPeerId, myName, connectedPeerIds]);

  // Send proximity reports when participating (but not sharing GPS)
  // This allows position to be estimated via triangulation
  useEffect(() => {
    // Only send proximity reports if:
    // 1. User opted in to show on map (isParticipating)
    // 2. User is NOT sharing GPS (they'd be an anchor instead)
    // 3. There are connected peers
    if (!isParticipating || isSharingGPS || connectedPeerIds.length === 0) return;

    const reportProximity = async () => {
      // For each anchor we're connected to, report estimated proximity
      const readings: ProximityReading[] = [];
      
      anchors.forEach((anchor, anchorPeerId) => {
        // If we're connected to this anchor, we estimate we're within range
        if (connectedPeerIds.includes(anchorPeerId)) {
          readings.push({
            targetPeerId: anchorPeerId,
            estimatedDistance: DEFAULT_PROXIMITY_DISTANCE,
          });
        }
      });
      
      // Send report even if no anchor readings yet
      // This lets the system know we exist and are participating
      console.log(`Sending proximity report with ${readings.length} connected anchors`);

      const message: ProximityReportMessage = {
        type: 'PROXIMITY_REPORT',
        peerId: myPeerId,
        peerName: myName,
        readings: readings,
        timestamp: new Date().toISOString(),
      };

      for (const peerId of connectedPeerIds) {
        try {
          await NearbyConnections.sendText(peerId, JSON.stringify(message));
        } catch (err) {
          console.error('Failed to send proximity report:', err);
        }
      }
    };

    // Send immediately, then every 3 seconds
    reportProximity();
    const interval = setInterval(reportProximity, 3000);
    return () => clearInterval(interval);
  }, [isParticipating, isSharingGPS, connectedPeerIds, myPeerId, myName, anchors]);

  // Actions
  const startParticipating = useCallback(() => {
    setIsParticipating(true);
  }, []);

  const stopParticipating = useCallback(() => {
    setIsParticipating(false);
    // Also stop GPS if it was on
    if (isSharingGPS) {
      stopTracking();
      setIsSharingGPS(false);
    }
  }, [isSharingGPS, stopTracking]);

  const startSharingGPS = useCallback(async () => {
    // Auto-enable participation when sharing GPS
    setIsParticipating(true);
    
    // Start GPS tracking
    await getCurrentLocation();
    await startTracking(5000);
    
    setIsSharingGPS(true);
  }, [getCurrentLocation, startTracking]);

  const stopSharingGPS = useCallback(() => {
    stopTracking();
    setIsSharingGPS(false);
    // Keep participating - will now show via proximity estimation
  }, [stopTracking]);

  const getMyAnchorMessage = useCallback((): GPSAnchorMessage | null => {
    if (!isSharingGPS || !location) return null;
    return {
      type: 'GPS_ANCHOR',
      peerId: myPeerId,
      peerName: myName,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp,
    };
  }, [isSharingGPS, location, myPeerId, myName]);

  return {
    isParticipating,
    isSharingGPS,
    myLocation: location,
    userPositions,
    startParticipating,
    stopParticipating,
    startSharingGPS,
    stopSharingGPS,
    getMyAnchorMessage,
  };
}
