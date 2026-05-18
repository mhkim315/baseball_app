import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { TeamProvider } from "@/lib/TeamContext";

function RootLayoutInner() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
        <Stack.Screen name="jikgwan" options={{ headerShown: false }} />
        <Stack.Screen name="cheer" options={{ headerShown: false }} />
        <Stack.Screen name="standings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <TeamProvider>
          <RootLayoutInner />
        </TeamProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
