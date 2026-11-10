import { Camera, type CameraRef, Map } from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { INITIAL_CAMERA, MAP_STYLE } from '@/constants/map';
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
  /** ID POI yang sudah dikunjungi (dwell event) → marker hijau. */
  visitedPoiIds?: ReadonlySet<string>;
  exploreMode?: boolean;
  onSelectPoi?: (poi: Poi) => void;
  onMapPress?: () => void;
  /** Ref ke kamera MapLibre (easeTo / flyTo / fitBounds). */
  mapRef?: React.Ref<CameraRef>;
};

// Peta MapLibre dengan basemap tile OpenStreetMap.
export function OsmMap({
  pois,
  userPosition,
  selectedPoiId,
  visitedPoiIds,
  exploreMode = false,
  onSelectPoi,
  onMapPress,
  mapRef,
}: OsmMapProps) {
  const markerPois = pois ?? getPois();

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={MAP_STYLE}
        compass={false}
        logo={false}
        attribution={false}
        touchPitch={false}
        onPress={onMapPress}
      >
        <Camera ref={mapRef} initialViewState={INITIAL_CAMERA} maxZoom={19} />
        <AreaOverlay />
        {userPosition ? (
          <UserLocation
            position={userPosition.coordinate}
            accuracyM={userPosition.accuracyM}
            exploreMode={exploreMode}
          />
        ) : null}
        {markerPois.map((poi) => (
          <PoiMarker
            key={poi.id}
            poi={poi}
            selected={selectedPoiId === poi.id}
            visited={visitedPoiIds?.has(poi.id) ?? false}
            onPress={onSelectPoi}
          />
        ))}
      </Map>
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
