import React from 'react';
import {StyleSheet, Button, View, Text, Alert, Platform} from 'react-native';
import {SafeAreaView, SafeAreaProvider} from 'react-native-safe-area-context';
import {startevent} from '../hooks/startevent';
import {joinevent} from '../hooks/joinevent';

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Button
        onPress={joinevent}
        title="Join an event"
        color="#841584"
        accessibilityLabel="Join an event"
      />
      <Button
        onPress={startevent}
        title="Start an event"
        color="#841584"
        accessibilityLabel="Start an event"
      />
    </View>
  );
}
