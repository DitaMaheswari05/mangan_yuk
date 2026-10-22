import MapView, { UrlTile } from 'react-native-maps';
import { INITIAL_REGION, OSM_TILE_URL } from '@/constants/map';
import { getPois } from '@/features/poi';
import { AreaOverlay } from './AreaOverlay';
import { MapAttribution } from './MapAttribution';
import { PoiMarker } from './PoiMarker';

export function OsmMap() {
  return (
    <>
      <MapView style={{ flex: 1 }} initialRegion={INITIAL_REGION} showsUserLocation>
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />
        <AreaOverlay />
        {getPois().map((poi) => (
          <PoiMarker key={poi.id} poi={poi} />
        ))}
      </MapView>
      <MapAttribution />
    </>
  );
}
