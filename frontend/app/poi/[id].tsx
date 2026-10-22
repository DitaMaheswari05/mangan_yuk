import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// F03: detail POI (foto, deskripsi, audio).
export default function PoiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>POI {id}</Text>
    </View>
  );
}
