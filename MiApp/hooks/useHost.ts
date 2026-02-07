import { useState, useEffect } from "react";
import * as NearbyConnections from "expo-nearby-connections";
import { BleManager, Device } from "react-native-ble-plx";

type PeerStatus = "CONNECTED_UNVERIFIED" | "VERIFIED";

type HostPeer = {
  peerId: string;
  status: PeerStatus;
  rssi?: number;
};

type AppMessage =
  | { type: "JOIN_REQUEST"; eventCode: string }
  | { type: "JOIN_ACCEPTED" }
  | { type: "JOIN_REJECTED"; reason: string }
  | { type: "RSSI_UPDATE"; peerId: string; rssi: number };

export function useHost(eventCode: string, optEventName?: string | null
) {
  const eventName = optEventName ?? "My Host Device";
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, HostPeer>>({});
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [peerRSSIMap, setPeerRSSIMap] = useState<Record<string, number>>({});

  /* ----------------------------------------
     1. Advertising lifecycle
  ---------------------------------------- */
  useEffect(() => {
    NearbyConnections.startAdvertise(eventName)
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
  }, [eventName]);

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

        // Handle RSSI updates from peers
        if (message.type === "RSSI_UPDATE") {
          setPeerRSSIMap((prev) => ({ ...prev, [message.peerId]: message.rssi }));
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

  // Initialize BLE Manager for reading real RSSI values
  const bleManager = new BleManager();

  // Periodically query actual RSSI values from connected BLE devices
  useEffect(() => {
    let isMounted = true;
    let scannedDevices: Device[] = [];
    
    const interval = setInterval(async () => {
      try {
        // First, get the state of the Bluetooth adapter
        const state = await bleManager.state();
        if (state !== "PoweredOn") {
          console.warn("Bluetooth is not powered on");
          return;
        }

        const updatedRssiMap: Record<string, number> = { ...peerRSSIMap };
        scannedDevices = [];

        // Start device scan
        bleManager.startDeviceScan(
          null,
          { allowDuplicates: true },
          (error: unknown, device: Device | null) => {
            if (error) {
              console.warn("Scan error:", error);
              bleManager.stopDeviceScan();
              return;
            }

            if (device && device.rssi) {
              scannedDevices.push(device);
              // Check if this device matches any of our connected peers
              for (const peerId of verifiedPeers) {
                if (device.id === peerId || device.name?.includes(peerId)) {
                  updatedRssiMap[peerId] = device.rssi;
                }
              }
            }
          }
        );

        // Stop scan after 1 second and update RSSI
        setTimeout(() => {
          bleManager.stopDeviceScan();
          if (isMounted) {
            setPeerRSSIMap(updatedRssiMap);
          }
        }, 1000);
      } catch (error) {
        console.error("Error updating RSSI values:", error);
      }
    }, 1000); // Scan every 1 second

    return () => {
      isMounted = false;
      clearInterval(interval);
      bleManager.stopDeviceScan().catch(() => {});
      bleManager.destroy();
    };
  }, [verifiedPeers, peerRSSIMap]);

  // Broadcast RSSI data to all peers periodically
  useEffect(() => {
    const interval = setInterval(() => {
      for (const peerId of verifiedPeers) {
        try {
          NearbyConnections.sendText(
            peerId,
            JSON.stringify({
              type: "RSSI_BROADCAST",
              rssiMap: peerRSSIMap,
            })
          );
        } catch (error) {
          console.warn("Failed to send RSSI to", peerId, error);
        }
      }
    }, 1000); // Update every 1 second

    return () => clearInterval(interval);
  }, [verifiedPeers, peerRSSIMap]);

  return {
    myPeerId,
    isAdvertising,
    verifiedPeers,
    peerRSSIMap,
  };
}
