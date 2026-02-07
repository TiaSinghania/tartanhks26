import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, RoomProps } from '../../constants/types';



export default function MainApp() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'hosting', 'joining'

  return (
    <View style={styles.container}>
      {appState === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.title}>Nearby Messenger</Text>
          <Button title="Start an Event (Host)" onPress={() => setAppState('hosting')} />
          <View style={{ height: 20 }} />
          <Button title="Join an Event" onPress={() => setAppState('joining')} />
        </View>
      )}

      {appState === 'hosting' && <HostRoom onExit={() => setAppState('idle')} />}
      {appState === 'joining' && <JoinRoom onExit={() => setAppState('idle')} />}
    </View>
  );
}

// --- HOST VIEW ---
function HostRoom({ onExit }: RoomProps) {
  const { myPeerId, connectedPeers } = useHost("My Room");
  const { messages, sendMessage } = useChat(connectedPeers);
  const [text, setText] = useState("");

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {myPeerId}</Text>
      <Text>Connected: {connectedPeers.length} people</Text>
      
      <ChatList messages={messages} />

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Broadcast to group..." />
        <Button title="Send" onPress={() => { sendMessage(text); setText(""); }} />
      </View>
      <Button title="End Event" color="red" onPress={onExit} />
    </View>
  );
}

// --- JOIN VIEW ---
function JoinRoom({ onExit }: RoomProps) {
  const { discoveredPeers, joinHost, isConnected, connectedHostId } = useJoin("Guest");
  const { messages, sendMessage } = useChat(isConnected ? [connectedHostId] : []);
  const [text, setText] = useState("");
  const [accessCode, setAccessCode] = useState("");

  if (isConnected) {
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
      <Text style={styles.header}>Nearby Events</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Enter Access Code" 
        value={accessCode} 
        onChangeText={setAccessCode} 
      />
      {discoveredPeers.map(peer => (
        <Button 
          key={peer.peerId} 
          title={`Join ${peer.peerName}`} 
          onPress={() => joinHost(peer.peerId)} 
        />
      ))}
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
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5 },
  chatList: { flex: 1, marginVertical: 20 },
  msg: { padding: 10, borderRadius: 10, marginVertical: 4, maxWidth: '80%' },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#E9E9EB' }
});