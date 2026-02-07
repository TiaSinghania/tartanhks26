import { useState, useEffect } from 'react';
import * as NearbyConnections from "expo-nearby-connections";
import { Peer, Message } from '../constants/types';


export function useJoin(userName = "Guest User") {
  const [myPeerId, setMyPeerId] = useState<any|null>(null);
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedHostId, setConnectedHostId] = useState<any|null>(null);

  // 1. Start Discovery on Mount
  useEffect(() => {
    NearbyConnections.startDiscovery(userName)
      .then((peerId: string) => {
        setMyPeerId(peerId);
        console.log("Discovery started. My ID:", peerId);
      })
      .catch((error: unknown) => {
        console.error("Discovery error:", error);
      });

    return () => {
      NearbyConnections.stopDiscovery();
    };
  }, [userName]);

  // 2. Manage Peer Listeners (Found/Lost)
  useEffect(() => {
    const onPeerFoundListener = NearbyConnections.onPeerFound((data: NearbyConnections.PeerFound) => {
      console.log("Found a host:", data.peerId);
      setDiscoveredPeers((prev) => {
        // Prevent duplicates if the same peer is found twice
        if (prev.find(p => p.peerId === data.peerId)) return prev;
        return [...prev, data];
      });
    });

    const onPeerLostListener = NearbyConnections.onPeerLost((data: NearbyConnections.PeerLost) => {
      console.log("Lost contact with:", data.peerId);
      setDiscoveredPeers((prev) => 
        prev.filter((peer) => peer.peerId !== data.peerId)
      );
    });

    return () => {
      onPeerFoundListener();
      onPeerLostListener();
    };
  }, []); // Empty array ensures this only runs once

  // 3. Manage Connection Success/Failure
  useEffect(() => {
    const onConnectedListener = NearbyConnections.onConnected((data: NearbyConnections.Connected) => {
      console.log("Successfully connected to host!");
      setIsConnected(true);
      setConnectedHostId(data.peerId);
    });

    const onDisconnectedListener = NearbyConnections.onDisconnected((data: NearbyConnections.Disconnected) => {
      console.log("Disconnected from host.");
      setIsConnected(false);
      setConnectedHostId(null);
    });

    return () => {
      onConnectedListener();
      onDisconnectedListener();
    };
  }, []);

  // 4. Action: Request a connection
  const joinHost = (selectedPeerId: string) => {
    console.log("Requesting join to:", selectedPeerId);
    NearbyConnections.requestConnection(selectedPeerId);
  };

  return {
    myPeerId,
    discoveredPeers,
    isConnected,
    connectedHostId,
    joinHost // Expose this function to be used on a button press
  };
}