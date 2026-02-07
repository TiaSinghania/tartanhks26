import { useState, useEffect, useCallback } from "react";
import * as NearbyConnections from "expo-nearby-connections";

type JoinState =
  | "IDLE"
  | "CONNECTING"
  | "AWAITING_AUTH"
  | "IN_ROOM";

type AppMessage =
  | { type: "JOIN_REQUEST"; eventCode: string }
  | { type: "JOIN_ACCEPTED" }
  | { type: "JOIN_REJECTED"; reason: string }
  | { type: "ROOM_CLOSED" };

export function useJoin(userName = "Guest User") {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [joinState, setJoinState] = useState<JoinState>("IDLE");
  const [connectedHostId, setConnectedHostId] = useState<string | null>(null);
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);

  /* ----------------------------------------
     1. Discovery lifecycle
  ---------------------------------------- */
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

  /* ----------------------------------------
     2. Peer discovery listeners
  ---------------------------------------- */
  useEffect(() => {
    const onPeerFoundListener =
      NearbyConnections.onPeerFound((data) => {
        console.log("Found host:", data.peerId);

        setDiscoveredPeers((prev) => {
          if (prev.find((p) => p.peerId === data.peerId)) return prev;
          return [...prev, data];
        });
      });

    const onPeerLostListener =
      NearbyConnections.onPeerLost((data) => {
        console.log("Lost host:", data.peerId);

        setDiscoveredPeers((prev) =>
          prev.filter((peer) => peer.peerId !== data.peerId)
        );
      });

    return () => {
      onPeerFoundListener();
      onPeerLostListener();
    };
  }, []);

  /* ----------------------------------------
     3. Connection + protocol listeners
  ---------------------------------------- */
  useEffect(() => {
    // Transport-level connection
    const onConnectedListener =
      NearbyConnections.onConnected(({ peerId }) => {
        console.log("Transport connected to host:", peerId);

        setConnectedHostId(peerId);
        setJoinState("AWAITING_AUTH");

        if (pendingEventCode) {
          NearbyConnections.sendText(
            peerId,
            JSON.stringify({
              type: "JOIN_REQUEST",
              eventCode: pendingEventCode,
            } satisfies AppMessage)
          );
        }
      });

    // App-level messages
    const onTextListener =
      NearbyConnections.onTextReceived(({ peerId, text }) => {
        let message: AppMessage;

        try {
          message = JSON.parse(text) as AppMessage;
        } catch {
          console.warn("Invalid payload from host");
          return;
        }

        if (message.type === "JOIN_ACCEPTED") {
          console.log("Join approved by host");
          setJoinState("IN_ROOM");
        }

        if (message.type === "JOIN_REJECTED") {
          console.log("Join rejected:", message.reason);

          NearbyConnections.disconnect(peerId);
          setJoinState("IDLE");
          setConnectedHostId(null);
          alert(message.reason);
        }
      // 2. Handle when Host ends the event
        if (message.type === "ROOM_CLOSED") {
          console.log("Host closed the room");
          
          // Optional: Give the user feedback
          alert("The host has ended the event.");

          // Clean up connection
          NearbyConnections.disconnect(peerId);
          setJoinState("IDLE");
          setConnectedHostId(null);
        }
      }
    );

    const onDisconnectedListener =
      NearbyConnections.onDisconnected(() => {
        console.log("Disconnected from host");

        setJoinState("IDLE");
        setConnectedHostId(null);
      });

    return () => {
      onConnectedListener();
      onTextListener();
      onDisconnectedListener();
    };
  }, [pendingEventCode]);

  /* ----------------------------------------
     4. Action: request to join a host
  ---------------------------------------- */
  const joinHost = (hostPeerId: string, eventCode: string) => {
    console.log("Requesting connection to:", hostPeerId);

    setPendingEventCode(eventCode);
    setJoinState("CONNECTING");

    NearbyConnections.requestConnection(hostPeerId);
  };

  // 3. New Action: User manually leaves
  const leaveRoom = useCallback(() => {
    if (connectedHostId) {
      console.log("User leaving room, disconnecting...");
      NearbyConnections.disconnect(connectedHostId);
    }
    
    // Reset local state immediately
    setJoinState("IDLE");
    setConnectedHostId(null);
    setPendingEventCode(null);
  }, [connectedHostId]);

  return {
    myPeerId,
    discoveredPeers,
    joinState,
    connectedHostId,
    joinHost,
    leaveRoom,
  };
}
