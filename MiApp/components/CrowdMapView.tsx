import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions, Modal, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { UserPosition } from '../constants/types';
import { IconSymbol } from './ui/icon-symbol';

interface CrowdMapViewProps {
  visible: boolean;
  onClose: () => void;
  userPositions: Map<string, UserPosition>;
  myPeerId: string;
  eventName?: string;
}

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export function CrowdMapView({ 
  visible, 
  onClose, 
  userPositions, 
  myPeerId,
  eventName 
}: CrowdMapViewProps) {
  const positions = useMemo(() => Array.from(userPositions.values()), [userPositions]);
  
  // Calculate map region to fit all users
  const mapRegion = useMemo(() => {
    if (positions.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };
    }

    const lats = positions.map(p => p.latitude);
    const lngs = positions.map(p => p.longitude);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    
    // Add padding to fit all markers
    const latDelta = Math.max((maxLat - minLat) * 1.5, LATITUDE_DELTA);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, LONGITUDE_DELTA);

    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [positions]);

  const getMarkerColor = (position: UserPosition, isMe: boolean) => {
    if (isMe) return '#4CAF50'; // Green for self
    if (position.source === 'gps') return '#2196F3'; // Blue for GPS anchors
    if (position.source === 'triangulated') return '#FF9800'; // Orange for triangulated
    if (position.source === 'estimated-2') return '#9C27B0'; // Purple for 2-anchor estimate
    return '#9E9E9E'; // Gray for 1-anchor estimated
  };

  const getMarkerTitle = (position: UserPosition, isMe: boolean) => {
    const suffix = isMe ? ' (You)' : '';
    const accuracy = position.accuracy < 10 
      ? '~' + position.accuracy.toFixed(0) + 'm'
      : '~' + (position.accuracy / 10).toFixed(0) + '0m';
    
    let sourceLabel = '';
    switch (position.source) {
      case 'gps': sourceLabel = 'GPS'; break;
      case 'triangulated': sourceLabel = '3+ anchors'; break;
      case 'estimated-2': sourceLabel = '2 anchors'; break;
      case 'estimated-1': sourceLabel = '1 anchor'; break;
    }
    return `${position.peerName}${suffix} (${accuracy}, ${sourceLabel})`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark.circle.fill" size={28} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {eventName ? `${eventName} - Crowd Map` : 'Crowd Map'}
          </Text>
          <View style={styles.headerRight}>
            <Text style={styles.userCount}>{positions.length} users</Text>
          </View>
        </View>

        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsCompass={true}
          showsScale={true}
        >
          {positions.map(position => {
            const isMe = position.peerId === myPeerId;
            const color = getMarkerColor(position, isMe);
            
            return (
              <React.Fragment key={position.peerId}>
                {/* For 1-anchor estimates: show ring around anchor showing possible locations */}
                {position.source === 'estimated-1' && position.anchorLat && position.anchorLng && position.anchorDistance && (
                  <Circle
                    center={{
                      latitude: position.anchorLat,
                      longitude: position.anchorLng,
                    }}
                    radius={position.anchorDistance}
                    fillColor="transparent"
                    strokeColor={`${color}AA`}
                    strokeWidth={2}
                    lineDashPattern={[10, 5]}
                  />
                )}
                
                {/* For 2-anchor estimates: show both distance rings */}
                {position.source === 'estimated-2' && position.anchorLat && position.anchorLng && position.anchorDistance && (
                  <>
                    <Circle
                      center={{
                        latitude: position.anchorLat,
                        longitude: position.anchorLng,
                      }}
                      radius={position.anchorDistance}
                      fillColor="transparent"
                      strokeColor={`${color}60`}
                      strokeWidth={1}
                      lineDashPattern={[5, 5]}
                    />
                    {position.anchor2Lat && position.anchor2Lng && position.anchor2Distance && (
                      <Circle
                        center={{
                          latitude: position.anchor2Lat,
                          longitude: position.anchor2Lng,
                        }}
                        radius={position.anchor2Distance}
                        fillColor="transparent"
                        strokeColor={`${color}60`}
                        strokeWidth={1}
                        lineDashPattern={[5, 5]}
                      />
                    )}
                  </>
                )}
                
                {/* Accuracy circle */}
                <Circle
                  center={{
                    latitude: position.latitude,
                    longitude: position.longitude,
                  }}
                  radius={position.accuracy}
                  fillColor={`${color}20`}
                  strokeColor={`${color}60`}
                  strokeWidth={1}
                />
                
                {/* User marker */}
                <Marker
                  coordinate={{
                    latitude: position.latitude,
                    longitude: position.longitude,
                  }}
                  title={getMarkerTitle(position, isMe)}
                  description={`Source: ${position.source}${position.isAnchor ? ' (Anchor)' : ''}`}
                  pinColor={color}
                  opacity={isMe ? 1 : 0.9}
                />
              </React.Fragment>
            );
          })}
        </MapView>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>You</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>GPS</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>3+ anchors</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
            <Text style={styles.legendText}>2 anchors</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9E9E9E' }]} />
            <Text style={styles.legendText}>1 anchor</Text>
          </View>
        </View>

        {positions.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol name="location.slash" size={48} color="#999" />
            <Text style={styles.emptyText}>No location data yet</Text>
            <Text style={styles.emptySubtext}>
              Users with GPS sharing will appear as anchors. Others will be estimated based on Bluetooth signal strength.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  userCount: {
    fontSize: 14,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
