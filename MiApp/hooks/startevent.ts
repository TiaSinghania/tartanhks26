import { Alert, Platform } from "react-native";

export function startevent() {
  const test = () => {
    Alert.alert(
      "Started!",
      Platform.OS === "ios"
        ? "Running on iOS"
        : "Running on Android"
    );
  };

  return { test };
}

