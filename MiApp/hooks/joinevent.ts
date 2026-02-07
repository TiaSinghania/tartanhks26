import { Alert, Platform } from "react-native";

export function joinevent() {
  const test = () => {
    Alert.alert(
      "Joined!",
      Platform.OS === "ios"
        ? "Running on iOS"
        : "Running on Android"
    );
  };

  return { test };
}
