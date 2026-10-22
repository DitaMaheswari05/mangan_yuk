export type Poi = {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  photos: string[];
  audio: string | null;
  audioDurationSec: number | null;
};

export type Trail = {
  id: string;
  name: string;
  description: string;
  poiIds: string[];
};
