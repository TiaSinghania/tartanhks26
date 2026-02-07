import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Request location permission
  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setPermission(granted);
      
      if (!granted) {
        setError('Location permission denied');
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission request failed');
      return false;
    }
  };

  // Get current location once
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const locationData: LocationData = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy || 0,
        timestamp: new Date().toISOString(),
      };
      
      setLocation(locationData);
      setError(null);
      return locationData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMsg);
      return null;
    }
  };

  // Start continuous location tracking
  const startTracking = async (updateInterval: number = 5000) => {
    try {
      // Request permission if not already granted
      if (permission === null) {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      setIsTracking(true);
      
      // Subscribe to location updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: updateInterval,
          distanceInterval: 0, // Update regardless of distance
        },
        (result: Location.LocationObject) => {
          const locationData: LocationData = {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            accuracy: result.coords.accuracy || 0,
            timestamp: new Date().toISOString(),
          };
          setLocation(locationData);
          setError(null);
        }
      );

      // Return subscription cleanup function
      return subscription.remove;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start tracking';
      setError(errorMsg);
      setIsTracking(false);
      return false;
    }
  };

  // Stop location tracking
  const stopTracking = (unsubscribe?: () => void) => {
    if (unsubscribe) {
      unsubscribe();
    }
    setIsTracking(false);
  };

  // Check permission status on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, []);

  return {
    location,
    permission,
    error,
    isTracking,
    requestPermission,
    getCurrentLocation,
    startTracking,
    stopTracking,
  };
};
