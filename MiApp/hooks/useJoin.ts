import { useState, useEffect } from "react";
import * as NearbyConnections from "expo-nearby-connections";
import { BleManager, Device } from "react-native-ble-plx";

type JoinState =
  | "IDLE"
  | "CONNECTING"
  | "AWAITING_AUTH"
  | "IN_ROOM";

type AppMessage =
  | { type: "JOIN_REQUEST"; eventCode: string }
  | { type: "JOIN_ACCEPTED" }
  | { type: "JOIN_REJECTED"; reason: string }
  | { type: "RSSI_UPDATE"; peerId: string; rssi: number }
  | { type: "RSSI_BROADCAST"; rssiMap: Record<string, number> };

export function useJoin(userName = "Guest User") {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [joinState, setJoinState] = useState<JoinState>("IDLE");
  const [connectedHostId, setConnectedHostId] = useState<string | null>(null);
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);
  const [peerRSSIMap, setPeerRSSIMap] = useState<Record<string, number>>({});

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
          return [...prev, { ...data }];
        });
      });

    const onPeerLostListener =
      NearbyConnections.onPeerLost((data) => {
        console.log("Lost host:", data.peerId);

        setDiscoveredPeers((prev) =>
          prev.filter((peer) => peer.peerId !== data.peerId)
        );
        
        setPeerRSSIMap((prev) => {
          const next = { ...prev };
          delete next[data.peerId];
          return next;
        });
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

        // Handle RSSI broadcast from host
        if (message.type === "RSSI_BROADCAST") {
          setPeerRSSIMap(message.rssiMap);
          return;
        }

        // Handle RSSI updates
        if (message.type === "RSSI_UPDATE") {
          setPeerRSSIMap((prev) => ({ ...prev, [message.peerId]: message.rssi }));
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
      });

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

  // Initialize BLE Manager for reading real RSSI values
  const bleManager = new BleManager();

  // Periodically query actual RSSI values from the connected host
  useEffect(() => {
    let isMounted = true;
    let scannedDevices: Device[] = [];
    
    const interval = setInterval(async () => {
      try {
        if (!connectedHostId) return;

        const state = await bleManager.state();
        if (state !== "PoweredOn") {
          console.warn("Bluetooth is not powered on");
          return;
        }

        scannedDevices = [];

        // Start device scan
        bleManager.startDeviceScan(
          null,
          { allowDuplicates: true },
          (error, device: Device | null) => {
            if (error) {
              console.warn("Scan error:", error);
              bleManager.stopDeviceScan();
              return;
            }

            if (device && device.rssi) {
              const knownPeerNames = discoveredPeers.map(p => p.name);
              // 2. Check if the BLE device name matches a known peer
              if (device.name && knownPeerNames.includes(device.name)) {
                // Find which PeerID belongs to this name
                const peer = discoveredPeers.find(p => p.name === device.name);
                
                if (peer && isMounted) {
                  setPeerRSSIMap((prev) => ({
                    ...prev,
                    [peer.peerId]: device.rssi // Map the RSSI to the PeerID the app understands
                  }));
                }
              }
            }
          }
        );

        // Stop scan after 1 second
        setTimeout(() => {
          bleManager.stopDeviceScan();
        }, 1000);
      } catch (error) {
        console.warn("Error updating RSSI values:", error);
      }
    }, 1000); // Scan every 1 second

    return () => {
      isMounted = false;
      clearInterval(interval);
      bleManager.stopDeviceScan().catch(() => {});
      bleManager.destroy();
    };
  }, [connectedHostId]);

  return {
    myPeerId,
    discoveredPeers,
    joinState,
    connectedHostId,
    joinHost,
    peerRSSIMap,
  };
}
