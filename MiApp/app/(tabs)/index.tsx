import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
// Note: You'll need to install this: npx expo install @react-native-async-storage/async-storage
import AsyncStorage from '@react-native-async-storage/async-storage';


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
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicMessage, setPanicMessage] = useState("");

  // Handle panic alerts
  React.useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.text.startsWith('🚨PANIC🚨')) {
      Alert.alert(
        "⚠️ EMERGENCY ALERT ⚠️",
        latestMessage.text.replace('🚨PANIC🚨', '').trim(),
        [{ text: "OK" }]
      );
    }
  }, [messages]);

  const handlePanic = () => {
    setShowPanicModal(true);
  };

  const sendPanicAlert = () => {
    const panicText = panicMessage.trim() 
      ? `🚨PANIC🚨 ${panicMessage.trim()}`
      : "🚨PANIC🚨 EMERGENCY - Need immediate help!";
    sendMessage(panicText);
    setPanicMessage("");
    setShowPanicModal(false);
  };

  const cancelPanic = () => {
    setPanicMessage("");
    setShowPanicModal(false);
  };

  // Filter out system messages or format them nicely
  const filteredMessages = messages.map(msg => {
    // If message is a join request object, convert it to a user-friendly string
    if (typeof msg.text === 'object' || (typeof msg.text === 'string' && msg.text.includes('{type'))) {
      return {
        ...msg,
        text: "Someone joined"
      };
    }
    // Don't show panic messages in chat (they're shown as alerts)
    if (msg.text.startsWith('🚨PANIC🚨')) {
      return {
        ...msg,
        text: "🚨 Emergency alert sent"
      };
    }
    return msg;
  });

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {eventName}</Text>
      <Text style={styles.header}>Event Code: {eventCode}</Text>
      <Text>Connected: {verifiedPeers.length} people</Text>
      
      <ChatList messages={filteredMessages} />

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Broadcast to group..." />
        <Button title="Send Blast" onPress={() => { sendMessage(text); setText(""); }} />
      </View>
      
      <View style={styles.panicButtonContainer}>
        <Button title="🚨 PANIC ALERT 🚨" color="#FF3B30" onPress={handlePanic} />
      </View>
      
      <Button title="End Event" color="red" onPress={onExit} />

      {/* Panic Modal */}
      {showPanicModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚨 Send Panic Alert?</Text>
            <Text style={styles.modalDescription}>
              This will send an emergency alert to everyone nearby. You can add an optional message:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Optional: Describe emergency..."
              value={panicMessage}
              onChangeText={setPanicMessage}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={cancelPanic} color="#999" />
              <View style={{ width: 10 }} />
              <Button title="Send Alert" onPress={sendPanicAlert} color="#FF3B30" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// --- JOIN VIEW ---
function JoinRoom({ onExit }: JoinRoomProps) {
  const [accessCode, setAccessCode] = useState("");
  const [text, setText] = useState("");
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicMessage, setPanicMessage] = useState("");
  
  const { discoveredPeers, joinHost, joinState, connectedHostId } = useJoin("Guest");
  
  const { messages, sendMessage } = useChat(
    joinState === "IN_ROOM" && connectedHostId
    ? [connectedHostId]
    : []);

  // Handle panic alerts
  React.useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.text.startsWith('🚨PANIC🚨')) {
      Alert.alert(
        "⚠️ EMERGENCY ALERT ⚠️",
        latestMessage.text.replace('🚨PANIC🚨', '').trim(),
        [{ text: "OK" }]
      );
    }
  }, [messages]);

  const handlePanic = () => {
    setShowPanicModal(true);
  };

  const sendPanicAlert = () => {
    const panicText = panicMessage.trim() 
      ? `🚨PANIC🚨 ${panicMessage.trim()}`
      : "🚨PANIC🚨 EMERGENCY - Need immediate help!";
    sendMessage(panicText);
    setPanicMessage("");
    setShowPanicModal(false);
  };

  const cancelPanic = () => {
    setPanicMessage("");
    setShowPanicModal(false);
  };

  // Filter out system messages for joined users too
  const filteredMessages = messages.map(msg => {
    if (typeof msg.text === 'object' || (typeof msg.text === 'string' && msg.text.includes('{type'))) {
      return {
        ...msg,
        text: "Someone joined"
      };
    }
    // Don't show panic messages in chat (they're shown as alerts)
    if (msg.text.startsWith('🚨PANIC🚨')) {
      return {
        ...msg,
        text: "🚨 Emergency alert sent"
      };
    }
    return msg;
  });

  if (joinState === "IN_ROOM") {
    return (
      <View style={styles.full}>
        <Text style={styles.header}>Connected to Host</Text>
        <ChatList messages={filteredMessages} />
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} />
          <Button title="Send" onPress={() => { sendMessage(text); setText(""); }} />
        </View>
        
        <View style={styles.panicButtonContainer}>
          <Button title="🚨 PANIC ALERT 🚨" color="#FF3B30" onPress={handlePanic} />
        </View>
        
        <Button title="Leave" onPress={onExit} />

        {/* Panic Modal */}
        {showPanicModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🚨 Send Panic Alert?</Text>
              <Text style={styles.modalDescription}>
                This will send an emergency alert to everyone nearby. You can add an optional message:
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Optional: Describe emergency..."
                value={panicMessage}
                onChangeText={setPanicMessage}
                multiline
                autoFocus
              />
              <View style={styles.modalButtons}>
                <Button title="Cancel" onPress={cancelPanic} color="#999" />
                <View style={{ width: 10 }} />
                <Button title="Send Alert" onPress={sendPanicAlert} color="#FF3B30" />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Join an Event</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Enter Access Code" 
        value={accessCode} 
        onChangeText={setAccessCode} 
      />
      
      <Text style={styles.subheader}>Available Events:</Text>
      <ScrollView style={styles.peerList}>
        {discoveredPeers.map((peer) => (
          <View key={peer.peerId} style={styles.peerItem}>
            <Text>{peer.name || 'Unknown Event'}</Text>
            <Button 
              title="Join" 
              onPress={() => {
                if (accessCode.trim()) {
                  // Pass both peer.id and accessCode as strings
                  joinHost(peer.peerId, accessCode);
                } else {
                  Alert.alert("Error", "Please enter the access code first");
                }
              }} 
            />
          </View>
        ))}
      </ScrollView>
      
      <View style={{ height: 20 }} />
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
          <Text style={m.isMe ? {color: 'white'} : {}}>{m.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  full: { flex: 1, padding: 40, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  subheader: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10 },
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
  peerList: { maxHeight: 300, marginBottom: 20 },
  peerItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9'
  },
  panicButtonContainer: {
    marginVertical: 15,
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 8,
    overflow: 'hidden'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});