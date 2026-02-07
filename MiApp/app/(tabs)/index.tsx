import React, { useState, useEffect } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
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
          <Button 
            title={"Create an Event"} 
            onPress={handleCreateEvent} 
          />

          <View style={{ height: 20 }} />
          <Button
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
          <Button title="Join an Event" onPress={() => setAppState('joining')} />
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
      <Text>Connected: {verifiedPeers.length} people</Text>
      <Text>Nearby Peers: {nearbyPeers.length}</Text>

      {nearbyPeers.map(p => (
        <Text key={p.id}>{p.id} — approx {estimateDistance(p.rssi)} meters away</Text>
      ))}

      <ChatList messages={messages} />

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Broadcast to group..." />
        <Button title="Send Blast" onPress={() => { sendMessage(text); setText(""); }} />
      </View>
      <Button title="End Event" color="red" onPress={onExit} />
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

  if (joinState === "IN_ROOM") {
    return (
      <View style={styles.full}>
        <Text style={styles.header}>Connected to Host</Text>
        <ChatList messages={messages} />
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} />
          <Button title="Send" onPress={() => { sendMessage(text); setText(""); }} />
        </View>
        <Button title="Leave" onPress={onExit} />
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <TextInput 
        style={styles.input} 
        placeholder="Enter Access Code" 
        value={accessCode} 
        onChangeText={setAccessCode} 
      />
      <Button title="Back" onPress={onExit} />
    </View>
  );
}

// --- SHARED CHAT UI ---
function ChatList({ messages }: { messages: Message[] }) {
  return (
    <ScrollView style={styles.chatList}>
      {messages.map((m: Message) => (
        <View key={m.id} style={[styles.msg, m.isMe ? styles.myMsg : styles.theirMsg]}>
          <Text style={m.isMe ? { color: 'white' } : {}}>{m.text}</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  full: { flex: 1, padding: 40, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5,
  width: '100%',
  height: 40,
  paddingHorizontal: 10,
  paddingVertical: 0,
  fontSize: 16,
  textAlignVertical: 'center', // Android fix
  },
  chatList: { flex: 1, marginVertical: 20 },
  msg: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: '80%' },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#E9E9EB' },

});
