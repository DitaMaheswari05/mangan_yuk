import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// F06: navigasi menuju POI.
export default function NavigateScreen() {
  const { poiId } = useLocalSearchParams<{ poiId: string }>();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Navigasi ke {poiId}</Text>
    </View>
  );
}
