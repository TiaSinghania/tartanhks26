import { useState, useEffect } from 'react';
import * as NearbyConnections from 'expo-nearby-connections';
import { Peer, Message } from '../constants/types';


export function useChat(connectedPeerIds: string[] = []) {
  const [messages, setMessages] = useState<any[]>([]);

  // 1. Listen for incoming messages
  useEffect(() => {
    const onTextReceivedListener = NearbyConnections.onTextReceived((data: NearbyConnections.TextReceived) => {
      let isSystemMessage = false;
      
      // Try to parse as JSON to check if it's a system message
      try {
        const parsed = JSON.parse(data.text);
        // Filter out RSSI and system messages
        if (parsed.type && ['RSSI_BROADCAST', 'RSSI_UPDATE', 'JOIN_REQUEST', 'JOIN_ACCEPTED', 'JOIN_REJECTED'].includes(parsed.type)) {
          isSystemMessage = true;
        }
      } catch (e) {
        // Not JSON, it's a regular message
      }
      
      if (isSystemMessage) return; // Don't display system messages in chat
      
      console.log("New chat message received:", data.text);
      
      setMessages((prev) => [
        ...prev, 
        {
          id: Date.now().toString(),
          senderId: data.peerId,
          text: data.text,
          timestamp: new Date().toLocaleTimeString(),
          isMe: false,
        }
      ]);
    });

    return () => {
      onTextReceivedListener();
    };
  }, []);

  // 2. Function to send messages
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      for (const id of connectedPeerIds) {
        await NearbyConnections.sendText(id, text);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          senderId: 'me',
          text: text,
          timestamp: new Date().toLocaleTimeString(),
          isMe: true,
        }
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return {
    messages,
    sendMessage,
    clearChat: () => setMessages([])
  };
}