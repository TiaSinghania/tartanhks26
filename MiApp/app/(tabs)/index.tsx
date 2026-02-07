import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { COLORS, BUTTON, BUTTON_TEXT, INPUT, INPUT_TEXT, CHAT, FONT_FAMILY } from '@/constants/theme';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
import { PrimaryButton } from '@/components/PrimaryButton';
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

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {eventName}</Text>
      <Text style={styles.header}>Event Code: {eventCode}</Text>
      <Text style={styles.text}>Connected: {verifiedPeers.length} people</Text>
      
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

  if (joinState === "IN_ROOM") {
    return (
      <View style={styles.full}>
        <Text style={styles.header}>Connected to Host</Text>
        <ChatList messages={messages} />
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} />
          <PrimaryButton title="Send" onPress={() => { sendMessage(text); setText(""); }} />
        </View>
        <PrimaryButton title="Leave" onPress={onExit} />
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
