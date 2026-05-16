import { Stack } from "expo-router";

export default function JikgwanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="camera" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}
