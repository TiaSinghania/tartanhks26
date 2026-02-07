import React, { useState, useEffect } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { COLORS, BUTTON, BUTTON_TEXT, INPUT, INPUT_TEXT, CHAT, FONT_FAMILY } from '@/constants/theme';
import { BleManager, Device } from 'react-native-ble-plx';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
import { PrimaryButton } from '@/components/PrimaryButton';
// Note: You'll need to install this: npx expo install @react-native-async-storage/async-storage
import AsyncStorage from '@react-native-async-storage/async-storage';
// --- BLE CONFIG ---
const SERVICE_UUID = '7A9F0000-0000-0000-0000-000000000000'; // your custom app UUID
const ID_ROTATION_INTERVAL = 1000 * 60 * 5; // rotate ID every 5 min

export default function MainApp() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'hosting', 'joining', 'creating'
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  const handleCreateEvent = async () => {
    if (!eventName || eventName.trim() === "") {
      Alert.alert("Error", "Please enter an event name.");
      return;
    }

    setAppState('creating');

    try {
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();

      await AsyncStorage.multiSet([
        ['saved_event_code', randomCode],
        ['saved_event_name', eventName],
      ]);

      setEventCode(randomCode);

      Alert.alert(
        "Success",
        `Event "${eventName}" created! Your code is: ${randomCode}`
      );
    } catch {
      Alert.alert("Error", "Failed to save the event to your device.");
    } finally {
      setAppState('idle');
    }
  };

  return (
    <View style={styles.container}>
      {appState === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.title}>coolest name ever</Text>
          
          <TextInput
              style={styles.input}
              placeholder="Enter Event Name"
              value={eventName ?? ""}
              onChangeText={setEventName}
            />
          <View style={{ height: 20 }} />

          <PrimaryButton 
            title={"Create an Event"} 
            onPress={handleCreateEvent} 
          />

          <View style={{ height: 40 }} />
          <PrimaryButton
            title="Start an Event (Host)"
            onPress={() => {
              if (eventCode !== null) {
                setAppState('hosting');
              } else {
                Alert.alert("Error", "No event started! Try creating an event first.");
              }
            }}
          />
          <View style={{ height: 20 }} />
          <PrimaryButton title="Join an Event" onPress={() => setAppState('joining')} />
        </View>
      )}

      {appState === 'hosting' && (
        <HostRoom
          eventCode={eventCode}
          eventName={eventName}
          onExit={() => {
            setEventCode(null);
            setEventName(null);
            setAppState('idle');
          }}
        />
      )}

      {appState === 'joining' && <JoinRoom onExit={() => setAppState('idle')} />}
    </View>
  );
}

// --- HOST VIEW ---
function HostRoom({ eventCode, eventName, onExit }: HostRoomProps) {
  if (eventCode === null) {
    return null;
  }
  const { myPeerId, verifiedPeers } = useHost(eventCode, eventName);
  const { messages, sendMessage } = useChat(verifiedPeers);
  const [text, setText] = useState("");
  const [bleManager] = useState(new BleManager());
  const [myBLEId, setMyBLEId] = useState(generateTempID());
  const [nearbyPeers, setNearbyPeers] = useState<{ id: string; rssi: number }[]>([]);

  // Rotate BLE ID every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => setMyBLEId(generateTempID()), ID_ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Start scanning for nearby devices
  useEffect(() => {
    const subscription = bleManager.onStateChange(state => {
      if (state === 'PoweredOn') {
        scanBLE();
      }
    }, true);

    return () => {
      subscription.remove();
      bleManager.stopDeviceScan();
    };
  }, []);

  const scanBLE = () => {
    bleManager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
      if (error) return;

      if (device && device.id && device.rssi != null) {
        const rssi = device.rssi;
        setNearbyPeers(prev => {
          const existing = prev.find(p => p.id === device.id);
          if (existing) {
            return prev.map(p => p.id === device.id ? { id: p.id, rssi } : p);
          } else {
            return [...prev, { id: device.id, rssi }];
          }
        });
      }
    });
  };

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {eventName}</Text>
      <Text style={styles.header}>Event Code: {eventCode}</Text>
      <Text style={styles.text}>Connected: {verifiedPeers.length} people</Text>
      <Text>Nearby Peers: {nearbyPeers.length}</Text>

      {nearbyPeers.map(p => (
        <Text key={p.id}>{p.id} — approx {estimateDistance(p.rssi)} meters away</Text>
      ))}

      <ChatList messages={messages} />


      <View style={styles.inputRow}>
        <TextInput 
          style={[styles.input]} // flex: 1 makes it take up remaining space
          value={text} 
          onChangeText={setText} 
          placeholder="Broadcast to group..." 
          placeholderTextColor={COLORS.textSecondary}
        />
        <View style={{ width: 20 }} /> {/* This creates your 20px right margin */}
        <PrimaryButton 
          title="Send Blast" 
          onPress={() => { sendMessage(text); setText(""); }} 
        />
      </View>
      <PrimaryButton title="End Event" onPress={onExit} />
    </View>
  );
  
}

// --- JOIN VIEW ---
function JoinRoom({ onExit }: JoinRoomProps) {
  const { discoveredPeers, joinHost, joinState, connectedHostId } = useJoin("Guest");
  const { messages, sendMessage } = useChat(
    joinState === "IN_ROOM" && connectedHostId
    ? [connectedHostId]
    : []);
  const [text, setText] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [bleManager] = useState(new BleManager());
  const [nearbyPeers, setNearbyPeers] = useState<{ id: string; rssi: number }[]>([]);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);

  if (joinState === "IN_ROOM") {
    return (
      <View style={styles.full}>
        <Text style={styles.header}>Connected to Host</Text>
        <Text>Nearby Peers: {nearbyPeers.length}</Text>
        {nearbyPeers.map(p => (
          <Text key={p.id}>{p.id} — approx {estimateDistance(p.rssi)} meters away</Text>
        ))}
        console.log("nearby peers map for joiner", nearbyPeers);
        <ChatList messages={messages} />
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} />
          <PrimaryButton title="Send" onPress={() => { sendMessage(text); setText(""); }} />
        </View>
        <PrimaryButton title="Leave" onPress={onExit} />
      </View>
    );
  }

  // Start BLE scanning for JoinRoom to capture RSSI to nearby devices (including host)
  useEffect(() => {
    const subscription = bleManager.onStateChange(state => {
      if (state === 'PoweredOn') {
        bleManager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
          if (error) return;

          if (device && device.id && device.rssi != null) {
            const rssi = device.rssi;
            setNearbyPeers(prev => {
              const existing = prev.find(p => p.id === device.id);
              if (existing) {
                return prev.map(p => p.id === device.id ? { id: p.id, rssi } : p);
              } else {
                return [...prev, { id: device.id, rssi }];
              }
            });
          }
        });
      }
    }, true);

    return () => {
      subscription.remove();
      bleManager.stopDeviceScan();
    };
  }, []);

  // Crowd crush detection: show alert when too many peers are very close
  useEffect(() => {
    const now = Date.now();
    const COOLDOWN_MS = 60 * 1000; // don't spam alerts more than once per minute

    // Define thresholds
    const CLOSE_RSSI_THRESHOLD = -60; // higher (less negative) means closer
    const PROPORTION_THRESHOLD = 0.6; // 60% of people
    const ABSOLUTE_COUNT_THRESHOLD = 8; // 8 or more close people

    // derive unique peer IDs seen via BLE
    const uniqueIds = Array.from(new Set(nearbyPeers.map(p => p.id)));
    // count how many are "very close"
    const closeCount = nearbyPeers.filter(p => p.rssi >= CLOSE_RSSI_THRESHOLD).length;

    // total known people in immediate area: include host if connectedHostId exists and not already in nearby list
    const totalSeen = uniqueIds.includes(connectedHostId ?? '') ? uniqueIds.length : uniqueIds.length + (connectedHostId ? 1 : 0);

    const proportionClose = totalSeen > 0 ? closeCount / totalSeen : 0;

    if ((closeCount >= ABSOLUTE_COUNT_THRESHOLD || proportionClose >= PROPORTION_THRESHOLD) && (now - lastAlertTime > COOLDOWN_MS)) {
      Alert.alert('WARNING: Crowd Crush Detected');
      setLastAlertTime(now);
    } else{
      console.log ("No crush: ", { closeCount, totalSeen, proportionClose, nearbyPeers });
    }
  }, [nearbyPeers, connectedHostId, lastAlertTime]);

  return (
    <View style={styles.full}>
      <TextInput 
        style={styles.input} 
        placeholder="Enter Access Code" 
        value={accessCode} 
        onChangeText={setAccessCode} 
      />
      <PrimaryButton title="Back" onPress={onExit} />
    </View>
  );
}

function ChatList({ messages }: { messages: Message[] }) {
  return (
    <ScrollView style={styles.chatList}>
      {messages.map((m) => (
        <View
          key={m.id}
          style={[styles.msg, m.isMe ? styles.myMsg : styles.theirMsg]}
        >
          <Text style={styles.msgText}>{m.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// --- UTILS ---
// Generate temporary rotating ID
function generateTempID() {
  return Math.random().toString(36).substring(2, 10);
}

// Rough distance estimation from RSSI
function estimateDistance(rssi: number) {
  const txPower = -59; // typical BLE txPower in dBm
  if (rssi === 0) return -1;
  const ratio = rssi / txPower;
  if (ratio < 1) return Math.pow(ratio, 10);
  else return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  full: {
    flex: 1,
    padding: 40,
    paddingTop: 60,
  },

  title: {
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 40,
    color: COLORS.textPrimary,
  },

  header: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    color: COLORS.textSecondary,
  },

  text: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
    color: COLORS.textPrimary,
  },

  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
    buttonPrimary: {
    height: BUTTON.height,
    backgroundColor: BUTTON.primary.bg,
    borderRadius: BUTTON.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonPrimaryText: {
    ...BUTTON_TEXT,
    color: BUTTON.primary.text,
  },


  input: {
    height: INPUT.height,
    backgroundColor: INPUT.bg,
    borderWidth: 1,
    borderColor: INPUT.border,
    borderRadius: INPUT.radius,

    paddingHorizontal: 10,

    color: INPUT.text,
    ...INPUT_TEXT,
  },


  chatList: {
    flex: 1,
    paddingVertical: 12,
  },

  msg: {
    padding: 10,
    borderRadius: CHAT.radius,
    marginVertical: 4,
    maxWidth: '82%',
  },

  myMsg: {
    alignSelf: 'flex-end',
    backgroundColor: CHAT.mineBg,
  },

  theirMsg: {
    alignSelf: 'flex-start',
    backgroundColor: CHAT.theirsBg,
  },

  msgText: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 15,
    lineHeight: 22,
    color: CHAT.text,
  },

});
