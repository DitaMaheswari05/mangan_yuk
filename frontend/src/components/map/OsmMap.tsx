import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { INITIAL_REGION, OSM_TILE_URL } from '@/constants/map';
import type { UserPosition } from '@/features/location';
import { getPois } from '@/features/poi';
import type { Poi } from '@/types/content';
import { AreaOverlay } from './AreaOverlay';
import { MapAttribution } from './MapAttribution';
import { PoiMarker } from './PoiMarker';
import { UserLocation } from './UserLocation';

export type OsmMapProps = {
  pois?: Poi[];
  userPosition?: UserPosition | null;
  selectedPoiId?: string | null;
  exploreMode?: boolean;
  onSelectPoi?: (poi: Poi) => void;
  onMapPress?: () => void;
  mapRef?: React.RefObject<MapView | null>;
};

export function OsmMap({
  pois,
  userPosition,
  selectedPoiId,
  exploreMode = false,
  onSelectPoi,
  onMapPress,
  mapRef,
}: OsmMapProps) {
  const markerPois = pois ?? getPois();

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={onMapPress}
      >
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />
        <AreaOverlay />
        {markerPois.map((poi) => (
          <PoiMarker
            key={poi.id}
            poi={poi}
            selected={selectedPoiId === poi.id}
            onPress={onSelectPoi}
          />
        ))}
        {userPosition ? (
          <UserLocation
            position={userPosition.coordinate}
            accuracyM={userPosition.accuracyM}
            exploreMode={exploreMode}
          />
        ) : null}
      </MapView>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
