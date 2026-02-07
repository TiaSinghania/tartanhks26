import { useState, useEffect, useCallback } from 'react';
import { PeerRSSIHistory, RSSISnapshot, CrowdCrushAlert } from '../constants/types';

interface CrowdCrushConfig {
  windowSizeMs?: number; // How far back to look for RSSI changes (default: 5000ms = 5 seconds)
  rssiThreshold?: number; // RSSI threshold for "nearby" (default: -70 dBm)
  closingInThreshold?: number; // RSSI improvement (less negative) to consider "moving closer" (default: 5 dBm)
  closingInProportionHigh?: number; // Trigger high alert at this proportion (default: 0.6 = 60%)
  closingInProportionMedium?: number; // Trigger medium alert at this proportion (default: 0.4 = 40%)
}

export function useCrowdCrushDetection(
  connectedPeerIds: string[] = [],
  peerRSSIMap: Record<string, number> = {},
  config: CrowdCrushConfig = {}
) {
  const {
    windowSizeMs = 5000,
    rssiThreshold = -70,
    closingInThreshold = 5,
    closingInProportionHigh = 0.6,
    closingInProportionMedium = 0.4,
  } = config;

  const [peerHistory, setPeerHistory] = useState<Record<string, PeerRSSIHistory>>({});
  const [alert, setAlert] = useState<CrowdCrushAlert>({
    detected: false,
    severity: 'low',
    closestPeers: 0,
    totalNearby: 0,
    message: '',
  });

  // Update RSSI history when new values come in
  useEffect(() => {
    const now = Date.now();

    setPeerHistory((prevHistory) => {
      const updatedHistory = { ...prevHistory };

      // Update or create history for connected peers
      for (const peerId of connectedPeerIds) {
        const newRssi = peerRSSIMap[peerId];

        if (newRssi === undefined || newRssi === null) continue;

        if (!updatedHistory[peerId]) {
          updatedHistory[peerId] = {
            peerId,
            rssiHistory: [],
            closingIn: false,
          };
        }

        // Add new RSSI reading
        updatedHistory[peerId].rssiHistory.push({
          peerId,
          rssi: newRssi,
          timestamp: now,
        });

        // Trim old entries outside the window
        updatedHistory[peerId].rssiHistory = updatedHistory[peerId].rssiHistory.filter(
          (entry) => now - entry.timestamp <= windowSizeMs
        );

        // Determine if peer is closing in
        const history = updatedHistory[peerId].rssiHistory;
        if (history.length >= 2) {
          const oldestRssi = history[0].rssi;
          const newestRssi = history[history.length - 1].rssi;
          // RSSI is stronger (less negative) = closer = positive change
          updatedHistory[peerId].closingIn = newestRssi - oldestRssi >= closingInThreshold;
        }
      }

      // Remove peers that are no longer connected
      for (const peerId in updatedHistory) {
        if (!connectedPeerIds.includes(peerId)) {
          delete updatedHistory[peerId];
        }
      }

      return updatedHistory;
    });
  }, [connectedPeerIds, peerRSSIMap, windowSizeMs, closingInThreshold]);

  // Analyze crowd crush risk
  const analyzeCrowdCrush = useCallback(() => {
    const nearbyPeers = Object.values(peerHistory).filter((peer) => {
      const latestRssi = peer.rssiHistory[peer.rssiHistory.length - 1]?.rssi;
      return typeof latestRssi === 'number' && latestRssi >= rssiThreshold;
    });

    const closingInPeers = nearbyPeers.filter((peer) => peer.closingIn);
    const totalNearby = nearbyPeers.length;
    const closestPeersCount = closingInPeers.length;

    let detected = false;
    let severity: 'low' | 'medium' | 'high' = 'low';
    let message = '';

    if (totalNearby > 0) {
      const closingInProportion = closestPeersCount / totalNearby;

      if (closingInProportion >= closingInProportionHigh) {
        detected = true;
        severity = 'high';
        message = `⚠️ HIGH DENSITY: ${closestPeersCount} of ${totalNearby} people moving toward you!`;
      } else if (closingInProportion >= closingInProportionMedium) {
        detected = true;
        severity = 'medium';
        message = `⚠️ CAUTION: ${closestPeersCount} of ${totalNearby} people moving closer`;
      } else if (closestPeersCount > 0) {
        severity = 'low';
        message = `ℹ️ Some people nearby are moving closer`;
      }
    }

    const newAlert = {
      detected,
      severity,
      closestPeers: closestPeersCount,
      totalNearby,
      message,
    } as CrowdCrushAlert;

    // Return computed alert instead of directly setting state so callers
    // (interval or other triggers) can set and log the newest alert immediately.
    return newAlert;
  }, [peerHistory, rssiThreshold, closingInProportionHigh, closingInProportionMedium]);

  // Run analysis periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const computed = analyzeCrowdCrush();
      setAlert(computed);
      console.log('Analyzed crowd crush risk:', computed);
    }, 5000); // Update alert every 5 seconds

    return () => clearInterval(interval);
  }, [analyzeCrowdCrush]);

  return {
    alert,
    peerHistory,
  };
}
