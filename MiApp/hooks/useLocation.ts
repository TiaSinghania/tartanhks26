import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { GPSLocation } from '../constants/types';

export const useLocation = () => {
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

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
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission request failed');
      return false;
    }
  };

  // Get current location once
  const getCurrentLocation = async (): Promise<GPSLocation | null> => {
    try {
      if (permission === null || permission === false) {
        const granted = await requestPermission();
        if (!granted) return null;
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const locationData: GPSLocation = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy || 10,
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
      if (permission === null || permission === false) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      // Stop existing subscription
      if (subscription) {
        subscription.remove();
      }

      setIsTracking(true);
      
      // Subscribe to location updates
      const newSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: updateInterval,
          distanceInterval: 0,
        },
        (result: Location.LocationObject) => {
          const locationData: GPSLocation = {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            accuracy: result.coords.accuracy || 10,
            timestamp: new Date().toISOString(),
          };
          setLocation(locationData);
          setError(null);
        }
      );

      setSubscription(newSubscription);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start tracking';
      setError(errorMsg);
      setIsTracking(false);
    }
  };

  // Stop location tracking
  const stopTracking = useCallback(() => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsTracking(false);
  }, [subscription]);

  // Check permission status on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [subscription]);

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