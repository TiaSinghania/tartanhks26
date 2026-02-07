import { useState, useEffect } from "react";
import * as NearbyConnections from "expo-nearby-connections";

type PeerStatus = "CONNECTED_UNVERIFIED" | "VERIFIED";

type HostPeer = {
  peerId: string;
  status: PeerStatus;
};

type AppMessage =
  | { type: "JOIN_REQUEST"; eventCode: string }
  | { type: "JOIN_ACCEPTED" }
  | { type: "JOIN_REJECTED"; reason: string };

export function useHost(eventCode: string, deviceName = "My Host Device") {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, HostPeer>>({});
  const [isAdvertising, setIsAdvertising] = useState(false);

  /* ----------------------------------------
     1. Advertising lifecycle
  ---------------------------------------- */
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

    return () => {
      NearbyConnections.stopAdvertise();
      setIsAdvertising(false);
    };
  }, [deviceName]);

  /* ----------------------------------------
     2. Connection + protocol listeners
  ---------------------------------------- */
  useEffect(() => {
    // Auto-accept transport connections
    const onInvitationListener =
      NearbyConnections.onInvitationReceived(({ peerId }) => {
        console.log("Invitation received from:", peerId);
        NearbyConnections.acceptConnection(peerId);
      });

    // Transport connection established
    const onConnectedListener =
      NearbyConnections.onConnected(({ peerId }) => {
        console.log("Peer transport-connected:", peerId);

        setPeers((prev) => ({
          ...prev,
          [peerId]: {
            peerId,
            status: "CONNECTED_UNVERIFIED",
          },
        }));
      });

    // Handle app-level messages
    const onTextListener =
      NearbyConnections.onTextReceived(({ peerId, text }) => {
        let message: AppMessage;

        try {
          message = JSON.parse(text) as AppMessage;
        } catch {
          console.warn("Invalid text from", peerId);
          return;
        }

        if (message.type === "JOIN_REQUEST") {
          if (message.eventCode === eventCode) {
            console.log("Peer verified:", peerId);

            NearbyConnections.sendText(
              peerId,
              JSON.stringify({ type: "JOIN_ACCEPTED" })
            );

            setPeers((prev) => ({
              ...prev,
              [peerId]: {
                peerId,
                status: "VERIFIED",
              },
            }));
          } else {
            console.log("Peer failed verification:", peerId);

            NearbyConnections.sendText(
              peerId,
              JSON.stringify({
                type: "JOIN_REJECTED",
                reason: "Invalid event code",
              })
            );

            NearbyConnections.disconnect(peerId);
          }
        }
      });

    const onDisconnectedListener =
      NearbyConnections.onDisconnected(({ peerId }) => {
        console.log("Peer disconnected:", peerId);

        setPeers((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      });

    return () => {
      onInvitationListener();
      onConnectedListener();
      onTextListener();
      onDisconnectedListener();
    };
  }, [eventCode]);

  /* ----------------------------------------
     3. Derived data for UI
  ---------------------------------------- */
  const verifiedPeers = Object.values(peers)
    .filter((p) => p.status === "VERIFIED")
    .map((p) => p.peerId);

  return {
    myPeerId,
    isAdvertising,
    verifiedPeers,
  };
}
