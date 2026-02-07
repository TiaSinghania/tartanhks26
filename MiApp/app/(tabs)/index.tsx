import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView, StyleSheet, Alert} from 'react-native';
import { COLORS, BUTTON, BUTTON_TEXT, INPUT, INPUT_TEXT, CHAT, FONT_FAMILY } from '@/constants/theme';
import { useHost } from '../..//hooks/useHost';
import { useJoin } from '../../hooks/useJoin';
import { useChat } from '../../hooks/useChat';
import { useCrowdCrushDetection } from '../../hooks/useCrowdCrushDetection';
import { Peer, Message, HostRoomProps, JoinRoomProps } from '../../constants/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CustomAlert } from '@/components/CustomAlert';
// Note: You'll need to install this: npx expo install @react-native-async-storage/async-storage
import AsyncStorage from '@react-native-async-storage/async-storage';

type AlertInfo = {
  title: string;
  message: string;
  buttons?: { text: string; onPress: () => void; type?: 'primary' | 'secondary' | 'danger' }[];
};


export default function MainApp() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'hosting', 'joining', 'creating'
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  // --- ALERT STATE ---
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo>({
    title: '',
    message: '',
    buttons: [],
  });
  function showAlert(title: string, message: string) {
    setAlertInfo({
      title,
      message,
      buttons: [
        { text: 'OK', onPress: () => setAlertVisible(false), type: 'primary' },
      ],
    });
    setAlertVisible(true);
  }


  const handleCreateEvent = async () => {
    if (!eventName || eventName.trim() === "") {
      showAlert("Error", "Please enter an event name.");
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

      showAlert("Success", `Event "${eventName}" created! Your code is: ${randomCode}`);
    } catch {
      showAlert("Error", "Failed to save the event to your device.");
    } finally {
      setAppState('idle');
    }
  };

  return (
    <View style={styles.container}>
      {appState === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.title}>peaceably</Text>
          
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
            variant="primary"
          />

          <CustomAlert
            visible={alertVisible}
            title={alertInfo.title}
            message={alertInfo.message}
            buttons={alertInfo.buttons}
          />

          <View style={{ height: 40 }} />
          <PrimaryButton
            title="Start an Event (Host)"
            onPress={() => {
              if (eventCode !== null) {
                setAppState('hosting');
              } else {
                showAlert("Error", "No event started! Try creating an event first.");
              }
            }
            }
            variant="primary"
          />
          <View style={{ height: 20 }} />
          <PrimaryButton title="Join an Event" onPress={() => setAppState('joining')} variant="primary" />
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
  const { myPeerId, verifiedPeers, peerRSSIMap } = useHost(eventCode, eventName);
  const { messages, sendMessage } = useChat(verifiedPeers);
  const { alert: crowdCrushAlert } = useCrowdCrushDetection(verifiedPeers, peerRSSIMap);
  
  const [text, setText] = useState("");
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicMessage, setPanicMessage] = useState("");

  // Handle panic alerts
  React.useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.text.startsWith('PANIC')) {
      Alert.alert(
        "EMERGENCY ALERT",
        latestMessage.text.replace('PANIC', '').trim(),
        [{ text: "OK" }]
      );
    }
  }, [messages]);

  const handlePanic = () => {
    setShowPanicModal(true);
  };

  const sendPanicAlert = () => {
    const panicText = panicMessage.trim() 
      ? `PANIC ${panicMessage.trim()}`
      : "PANIC EMERGENCY - Need immediate help!";
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
    if (msg.text.startsWith('PANIC')) {
      return {
        ...msg,
        text: "Emergency alert sent"
      };
    }
    return msg;
  });

  return (
    <View style={styles.full}>
      <Text style={styles.header}>Hosting: {eventName}</Text>
      <Text style={styles.header}>Event Code: {eventCode}</Text>
      <Text style={styles.text}>Connected: {verifiedPeers.length} people</Text>
      
      {/* Crowd Crush Alert */}
      {crowdCrushAlert.detected && (
        <View style={[styles.crowdCrushAlert, styles[`alert_${crowdCrushAlert.severity}`]]}>
          <Text style={styles.crowdCrushAlertText}>{crowdCrushAlert.message}</Text>
          <Text style={styles.crowdCrushAlertSubtext}>
            {crowdCrushAlert.closestPeers} of {crowdCrushAlert.totalNearby} people moving toward you
          </Text>
        </View>
      )}
      
      <ChatList messages={filteredMessages} />


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
          onPress={() => { sendMessage(text); setText(""); } } variant="primary"
        />
      </View>
      
      <PrimaryButton title="End Event" onPress={onExit} variant="secondary"/>
      
      <View style={styles.panicButtonContainer}>
        <PrimaryButton title="PANIC ALERT" onPress={handlePanic} variant="danger"/>
      </View>
      
      

      {/* Panic Modal */}
      {showPanicModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}> Send Panic Alert?</Text>
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
              <PrimaryButton title="Cancel" onPress={cancelPanic} variant="secondary"/>
              <View style={{ width: 10 }} />
              <PrimaryButton title="Send Alert" onPress={sendPanicAlert} variant="danger" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// --- JOIN VIEW ---
// TODO: LOL ADD A REQUEST TO JOIN BUTTON
function JoinRoom({ onExit }: JoinRoomProps) {
  const [accessCode, setAccessCode] = useState("");
  const [text, setText] = useState("");
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicMessage, setPanicMessage] = useState("");
  
  const { discoveredPeers, joinHost, joinState, connectedHostId, peerRSSIMap } = useJoin("Guest");
  
  const { messages, sendMessage } = useChat(
    joinState === "IN_ROOM" && connectedHostId
    ? [connectedHostId]
    : []);

  // Get crowd crush detection for all peers (host + other members if available)
  const allConnectedPeers = connectedHostId ? [connectedHostId] : [];
  const { alert: crowdCrushAlert } = useCrowdCrushDetection(allConnectedPeers, peerRSSIMap);

  // Handle panic alerts
  React.useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.text.startsWith('PANIC')) {
      Alert.alert(
        "EMERGENCY ALERT",
        latestMessage.text.replace('PANIC', '').trim(),
        [{ text: "OK" }]
      );
    }
  }, [messages]);

  const handlePanic = () => {
    setShowPanicModal(true);
  };

  const sendPanicAlert = () => {
    const panicText = panicMessage.trim() 
      ? `PANIC ${panicMessage.trim()}`
      : "PANIC EMERGENCY - Need immediate help!";
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
    if (msg.text.startsWith('PANIC')) {
      return {
        ...msg,
        text: "Emergency alert sent"
      };
    }
    return msg;
  });

  if (joinState === "IN_ROOM") {
    return (
      <View style={styles.full}>
        <Text style={styles.header}>Connected to Host</Text>
        
        {/* Crowd Crush Alert */}
        {crowdCrushAlert.detected && (
          <View style={[styles.crowdCrushAlert, styles[`alert_${crowdCrushAlert.severity}`]]}>
            <Text style={styles.crowdCrushAlertText}>{crowdCrushAlert.message}</Text>
            <Text style={styles.crowdCrushAlertSubtext}>
              {crowdCrushAlert.closestPeers} of {crowdCrushAlert.totalNearby} people moving toward you
            </Text>
          </View>
        )}
        
        <ChatList messages={filteredMessages} />
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={text} onChangeText={setText} />
          <PrimaryButton title="Send" onPress={() => { sendMessage(text); setText(""); }}  variant="primary"/>
        </View>
        
        <View style={styles.panicButtonContainer}>
          <PrimaryButton title="PANIC ALERT" onPress={handlePanic} variant="danger"/>
        </View>
        
        <PrimaryButton title="Leave" onPress={onExit} variant="danger"/>

        {/* Panic Modal */}
        {showPanicModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}> Send Panic Alert?</Text>
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
                <PrimaryButton title="Cancel" onPress={cancelPanic} variant="secondary" />
                <View style={{ width: 10 }} />
                <PrimaryButton title="Send Alert" onPress={sendPanicAlert} variant="danger" />
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
            <PrimaryButton 
              title="Join" 
              onPress={() => {
                if (accessCode.trim()) {
                  // Pass both peer.id and accessCode as strings
                  joinHost(peer.peerId, accessCode);
                } else {
                  Alert.alert("Error", "Please enter the access code first");
                }
              }} 
              variant="primary"
            />
          </View>
        ))}
      </ScrollView>
      
      <View style={{ height: 20 }} />
      <PrimaryButton title="Back" onPress={onExit} variant="primary"/>
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
  // --- Containers & Layout ---
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

  // --- Text ---
  title: {
    fontFamily: FONT_FAMILY?.mono,
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 40,
    color: COLORS.textPrimary,
  },
  header: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    color: COLORS.textSecondary,
  },
  subheader: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: COLORS.textPrimary,
  },
  text: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
    color: COLORS.textPrimary,
  },

  // --- Inputs & Rows ---
  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
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

  // --- Buttons ---
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

  // --- Chat ---
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

  // --- Peer List (from teammate) ---
  peerList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  peerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
  },

  // --- Panic Button Container (from teammate) ---
  panicButtonContainer: {
    marginVertical: 15,
    borderWidth: 2,
    borderColor: COLORS.danger,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // --- Crowd Crush Alert ---
  crowdCrushAlert: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderLeftWidth: 4,
  },
  alert_high: {
    backgroundColor: '#ffebee',
    borderLeftColor: '#d32f2f',
  },
  alert_medium: {
    backgroundColor: '#fff3e0',
    borderLeftColor: '#f57c00',
  },
  alert_low: {
    backgroundColor: '#f1f8e9',
    borderLeftColor: '#558b2f',
  },
  crowdCrushAlertText: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  crowdCrushAlertSubtext: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 12,
    color: '#424242',
  },

  // --- Modal / Panic Modal ---
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
    backgroundColor: COLORS.surface,
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
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  modalDescription: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: INPUT.border,
    borderRadius: INPUT.radius,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: INPUT.text,
    fontFamily: FONT_FAMILY?.sans,
    backgroundColor: INPUT.bg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
