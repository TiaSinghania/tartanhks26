import { useState, useEffect } from 'react';
import * as NearbyConnections from 'expo-nearby-connections';
import { Peer, Message } from '../constants/types';


export function useChat(connectedPeerIds: string[] = []) {
  const [messages, setMessages] = useState<any[]>([]);

  // 1. Listen for incoming messages
  useEffect(() => {
    const onTextReceivedListener = NearbyConnections.onTextReceived((data: NearbyConnections.TextReceived) => {
      console.log("New message received:", data.text);
      
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