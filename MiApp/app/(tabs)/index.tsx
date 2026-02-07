import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TextInput, FlatList, Alert, Platform } from 'react-native';
import * as NearbyConnections from 'expo-nearby-connections';
import { PERMISSIONS, RESULTS, request } from 'react-native-permissions';

interface Peer {
  peerId: string;
  name: string;
}

interface Message {
  from: string;
  text: string;
}

export default function App() {
  const [myPeerId, setMyPeerId] = useState('');
  const [username, setUsername] = useState('User' + Math.floor(Math.random() * 1000));
  const [discoveredPeers, setDiscoveredPeers] = useState<Peer[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [mode, setMode] = useState<string | null>(null);

  // Request Bluetooth permission
  const requestPermissions = async () => {
    if (Platform.OS === 'ios') {
      const result = await request(PERMISSIONS.IOS.BLUETOOTH);
      return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
    }
    return true;
  };

  // Start advertising
  const startAdvertising = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Bluetooth permission is required');
      return;
    }

    try {
      const peerId = await NearbyConnections.startAdvertise(username);
      setMyPeerId(peerId);
      setMode('advertise');
      Alert.alert('Success', 'Now advertising as: ' + username);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to start advertising: ' + message);
    }
  };

  // Start discovery
  const startDiscovering = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Bluetooth permission is required');
      return;
    }

    try {
      const peerId = await NearbyConnections.startDiscovery(username);
      setMyPeerId(peerId);
      setMode('discover');
      Alert.alert('Success', 'Now discovering nearby devices...');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to start discovery: ' + message);
    }
  };

  // Connect to peer
  const connectToPeer = async (peerId: string) => {
    try {
      await NearbyConnections.requestConnection(peerId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to connect: ' + message);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageText.trim()) return;
    if (connectedPeers.length === 0) {
      Alert.alert('Not Connected', 'No connected peers');
      return;
    }

    try {
      for (const peerId of connectedPeers) {
        await NearbyConnections.sendText(peerId, messageText);
      }
      setMessages(prev => [...prev, { from: 'Me', text: messageText }]);
      setMessageText('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to send message: ' + message);
    }
  };

  // Setup listeners
  useEffect(() => {
    const listeners: (() => void)[] = [];

    listeners.push(NearbyConnections.onPeerFound(({peerId, name}: Peer) => {
      console.log('Peer found:', name);
      setDiscoveredPeers(prev => {
        if (prev.find(p => p.peerId === peerId)) return prev;
        return [...prev, {peerId, name}];
      });
    }));

    listeners.push(NearbyConnections.onPeerLost(({peerId}: {peerId: string}) => {
      console.log('Peer lost:', peerId);
      setDiscoveredPeers(prev => prev.filter(p => p.peerId !== peerId));
    }));

    listeners.push(NearbyConnections.onInvitationReceived(({peerId, name}: Peer) => {
      console.log('Invitation from:', name);
      Alert.alert(
        'Connection Request',
        `${name} wants to connect`,
        [
          { text: 'Reject', onPress: () => NearbyConnections.rejectConnection(peerId) },
          { text: 'Accept', onPress: () => NearbyConnections.acceptConnection(peerId) }
        ]
      );
    }));

    listeners.push(NearbyConnections.onConnected(({peerId, name}: Peer) => {
      console.log('Connected to:', name);
      setConnectedPeers(prev => {
        if (prev.includes(peerId)) return prev;
        return [...prev, peerId];
      });
      Alert.alert('Connected', `Connected to ${name}`);
    }));

    listeners.push(NearbyConnections.onDisconnected(({peerId}: {peerId: string}) => {
      console.log('Disconnected from:', peerId);
      setConnectedPeers(prev => prev.filter(p => p !== peerId));
      Alert.alert('Disconnected', 'Peer disconnected');
    }));

    listeners.push(NearbyConnections.onTextReceived(({peerId, text}: {peerId: string; text: string}) => {
      console.log('Message received:', text);
      setMessages(prev => [...prev, { from: peerId, text }]);
    }));

    return () => {
      listeners.forEach(unsub => unsub());
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bluetooth Messenger</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Your username"
        value={username}
        onChangeText={setUsername}
      />

      <View style={styles.buttonRow}>
        <Button title="Start Hosting" onPress={startAdvertising} />
        <Button title="Find Devices" onPress={startDiscovering} />
      </View>

      {mode && <Text style={styles.status}>Mode: {mode}</Text>}
      {myPeerId && <Text style={styles.peerId}>My ID: {myPeerId.substring(0, 8)}...</Text>}

      {discoveredPeers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovered Peers:</Text>
          {discoveredPeers.map(peer => (
            <View key={peer.peerId} style={styles.peerItem}>
              <Text>{peer.name}</Text>
              <Button title="Connect" onPress={() => connectToPeer(peer.peerId)} />
            </View>
          ))}
        </View>
      )}

      {connectedPeers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected: {connectedPeers.length} peer(s)</Text>
        </View>
      )}

      <View style={styles.messagesContainer}>
        <Text style={styles.sectionTitle}>Messages:</Text>
        <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({item}) => (
            <Text style={styles.message}>{item.from}: {item.text}</Text>
          )}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 5,
  },
  peerId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  peerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    marginBottom: 5,
    borderRadius: 5,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 10,
  },
  message: {
    padding: 8,
    backgroundColor: '#e8f5e9',
    marginBottom: 5,
    borderRadius: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginRight: 10,
    borderRadius: 5,
  },
});