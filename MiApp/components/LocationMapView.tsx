import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface PeerLocation {
  peerId: string;
  peerName?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface LocationMapViewProps {
  myLocation?: { latitude: number; longitude: number; accuracy: number };
  peerLocations: PeerLocation[];
  myName?: string;
}

export const LocationMapView: React.FC<LocationMapViewProps> = ({
  myLocation,
  peerLocations,
  myName = 'Me',
}) => {
  if (!myLocation) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Waiting for your location...</Text>
      </View>
    );
  }

  // Calculate bounds to show all markers
  const allMarkers = [
    { latitude: myLocation.latitude, longitude: myLocation.longitude },
    ...peerLocations.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
  ];

  const latitudes = allMarkers.map(m => m.latitude);
  const longitudes = allMarkers.map(m => m.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: (maxLat - minLat) * 1.2 || 0.05,
          longitudeDelta: (maxLng - minLng) * 1.2 || 0.05,
        }}
      >
        {/* Show my location */}
        <Marker
          coordinate={{
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
          }}
          title={myName}
          description={`Accuracy: ${myLocation.accuracy.toFixed(0)}m`}
          pinColor="blue"
        />

        {/* Show peer locations */}
        {peerLocations.map(peer => (
          <Marker
            key={peer.peerId}
            coordinate={{
              latitude: peer.latitude,
              longitude: peer.longitude,
            }}
            title={peer.peerName || 'Unknown User'}
            description={`Accuracy: ${peer.accuracy.toFixed(0)}m`}
            pinColor="red"
          />
        ))}
      </MapView>

      {/* Location list below map */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoTitle}>Nearby Users ({peerLocations.length + 1})</Text>
        <ScrollView style={styles.infoList}>
          {/* My location */}
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, { backgroundColor: 'blue' }]} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationName}>{myName} (You)</Text>
              <Text style={styles.locationCoords}>
                {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
              </Text>
              <Text style={styles.locationAccuracy}>
                Accuracy: ±{myLocation.accuracy.toFixed(0)}m
              </Text>
            </View>
          </View>

          {/* Peer locations */}
          {peerLocations.map(peer => (
            <View key={peer.peerId} style={styles.locationItem}>
              <View style={[styles.locationDot, { backgroundColor: 'red' }]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{peer.peerName || 'Unknown User'}</Text>
                <Text style={styles.locationCoords}>
                  {peer.latitude.toFixed(4)}, {peer.longitude.toFixed(4)}
                </Text>
                <Text style={styles.locationAccuracy}>
                  Accuracy: ±{peer.accuracy.toFixed(0)}m
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 0.6,
    width: '100%',
  },
  infoPanel: {
    flex: 0.4,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    padding: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
    marginTop: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  locationAccuracy: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});
