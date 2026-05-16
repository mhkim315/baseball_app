import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
        <Stack.Screen name="jikgwan" options={{ headerShown: false }} />
        <Stack.Screen name="community" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
        <Stack.Screen name="nickname-setup" options={{ presentation: "modal" }} />
        <Stack.Screen name="cheer" options={{ headerShown: false }} />
        <Stack.Screen name="standings" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
