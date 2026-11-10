declare module '@maplibre/maplibre-react-native' {
  import type React from 'react';

  export interface CameraRef {
    easeTo: (config: {
      center?: [number, number];
      zoom?: number;
      duration?: number;
      pitch?: number;
      heading?: number;
    }) => void;
    setCamera: (config: Record<string, unknown>) => void;
  }

  export type LngLat = [number, number];
  export type StyleSpecification = any;

  export const Map: React.ComponentType<any>;
  export const MapView: React.ComponentType<any>;
  export const Camera: React.ComponentType<any>;
  export const ShapeSource: React.ComponentType<any>;
  export const GeoJSONSource: React.ComponentType<any>;
  export const Layer: React.ComponentType<any>;
  export const LineLayer: React.ComponentType<any>;
  export const FillLayer: React.ComponentType<any>;
  export const CircleLayer: React.ComponentType<any>;
  export const PointAnnotation: React.ComponentType<any>;
  export const MarkerView: React.ComponentType<any>;
  export const Marker: React.ComponentType<any>;
  export const setAccessToken: (token: string | null) => void;

  const defaultExport: any;
  export default defaultExport;
}

declare module 'react-native-svg' {
  import type React from 'react';
  export const Svg: React.ComponentType<any>;
  export const Path: React.ComponentType<any>;
  export const Circle: React.ComponentType<any>;
  export const Rect: React.ComponentType<any>;
  export const G: React.ComponentType<any>;
  const defaultExport: any;
  export default defaultExport;
}

declare module '@expo/vector-icons' {
  import type React from 'react';
  export const Ionicons: React.ComponentType<any>;
  export const MaterialCommunityIcons: React.ComponentType<any>;
  export const FontAwesome: React.ComponentType<any>;
  export const Feather: React.ComponentType<any>;
}
