import { useState, useEffect } from 'react';
import * as NearbyConnections from "expo-nearby-connections";
import { Peer, Message } from '../constants/types';

export function useHost(deviceName = "My Host Device") {
  const [myPeerId, setMyPeerId] = useState<any|null>(null);
  const [connectedPeers, setConnectedPeers] = useState<any[]>([]);
  const [isAdvertising, setIsAdvertising] = useState(false);

  // 1. Manage the Advertisement
  useEffect(() => {
    NearbyConnections.startAdvertise(deviceName)
      .then((peerId: string) => {
        setMyPeerId(peerId);
        setIsAdvertising(true);
        console.log("Advertising started, ID:", peerId);
      })
      .catch((error: unknown) => {
        console.error("Failed to start advertising:", error);
      });

    // Cleanup: This runs when the component using the hook "unmounts"
    return () => {
      NearbyConnections.stopAdvertise();
      setIsAdvertising(false);
    };
  }, [deviceName]);

  // 2. Manage the Listeners
  useEffect(() => {
    // When someone wants to join, we automatically accept for now
    const onInvitationListener = NearbyConnections.onInvitationReceived((data: NearbyConnections.InvitationReceived) => {
      console.log("Invitation received from:", data.peerId);
      NearbyConnections.acceptConnection(data.peerId);
    });

    const onConnectedListener = NearbyConnections.onConnected((data: NearbyConnections.Connected) => {
      console.log("Peer connected:", data.peerId);
      setConnectedPeers((prev) => [...prev, data.peerId]);
    });

    const onDisconnectedListener = NearbyConnections.onDisconnected((data: NearbyConnections.Disconnected) => {
      console.log("Peer disconnected:", data.peerId);
      setConnectedPeers((prev) => prev.filter((id) => id !== data.peerId));
    });

    // Cleanup: Unsubscribe from listeners to prevent memory leaks
    return () => {
      onInvitationListener();
      onConnectedListener();
      onDisconnectedListener();
    };
  }, []);

  // Return the data so your UI can use it
  return {
    myPeerId,
    connectedPeers,
    isAdvertising
  };
}