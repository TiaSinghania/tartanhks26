import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { COLORS } from '@/constants/theme';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
// Note: You'll need to install this: npx expo install @react-native-async-storage/async-storage
// import AsyncStorage from '@react-native-async-storage/async-storage';


export default function MainApp() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'hosting', 'joining', 'creating'
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  // const handleCreateEvent = async () => {
  //   if (!eventName || eventName.trim() === "") {
  //     Alert.alert("Error", "Please enter an event name.");
  //     return;
  //   }

  //   setAppState('creating');

  //   try {
  //     const randomCode = Math.floor(100000 + Math.random() * 900000).toString();

  //     await AsyncStorage.multiSet([
  //       ['saved_event_code', randomCode],
  //       ['saved_event_name', eventName],
  //     ]);

  //     setEventCode(randomCode);

  //     Alert.alert(
  //       "Success",
  //       `Event "${eventName}" created! Your code is: ${randomCode}`
  //     );
  //   } catch {
  //     Alert.alert("Error", "Failed to save the event to your device.");
  //   } finally {
  //     setAppState('idle');
  //   }
  // };

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
            // onPress={handleCreateEvent} 
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
  // return null;
  // if (eventCode === null) {
  //   return null;
  // }
  // const { myPeerId, verifiedPeers } = useHost(eventCode, eventName);
  // const { messages, sendMessage } = useChat(verifiedPeers);
  // const [text, setText] = useState("");

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {eventName}</Text>
      <Text style={styles.header}>Event Code: {eventCode}</Text>
      {/* <Text>Connected: {verifiedPeers.length} people</Text> */}
      
      {/* <ChatList messages={messages} /> */}

      <View style={styles.inputRow}>
        {/* <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Broadcast to group..." /> */}
        {/* <Button title="Send Blast" onPress={() => { sendMessage(text); setText(""); }} /> */}
      </View>
      <Button title="End Event" color="red" onPress={onExit} />
    </View>
  );
  
}

// --- JOIN VIEW ---
function JoinRoom({ onExit }: JoinRoomProps) {
  // return null;
//   const { discoveredPeers, joinHost, joinState, connectedHostId } = useJoin("Guest");
//   const { messages, sendMessage } = useChat(
//     joinState === "IN_ROOM" && connectedHostId
//     ? [connectedHostId]
//     : []);
//   const [text, setText] = useState("");
//   const [accessCode, setAccessCode] = useState("");

//   if (joinState === "IN_ROOM") {
//     return (
//       <View style={styles.full}>
//         <Text style={styles.header}>Connected to Host</Text>
//         <ChatList messages={messages} />
//         <View style={styles.inputRow}>
//           <TextInput style={styles.input} value={text} onChangeText={setText} />
//           <Button title="Send" onPress={() => { sendMessage(text); setText(""); }} />
//         </View>
//         <Button title="Leave" onPress={onExit} />
//       </View>
//     );
//   }

  return (
    <View style={styles.full}>
      <TextInput 
        style={styles.input} 
        placeholder="Enter Access Code" 
        // value={accessCode} 
        // onChangeText={setAccessCode} 
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
          <Text style={m.isMe ? {color: 'white'} : {}}>{m.text}</Text>
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

  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,

    height: 40,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 16,

    borderRadius: 2,
    textAlignVertical: 'center', // Android fix
  },

  chatList: {
    flex: 1,
    marginVertical: 20,
  },

  msg: {
    padding: 10,
    borderRadius: 3,
    marginVertical: 4,
    maxWidth: '80%',
  },

  myMsg: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.myMsg,
  },

  theirMsg: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.theirMsg,
  },

  msgText: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },
});
