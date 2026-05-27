import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { TeamProvider } from "@/lib/TeamContext";
import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, AppState } from "react-native";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Root ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>오류가 발생했습니다</Text>
          <Text style={{ fontSize: 14, color: "#888", textAlign: "center", marginBottom: 20 }}>
            앱을 다시 시작해주세요
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: "#000", borderRadius: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayoutInner() {
  const { isDark } = useTheme();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        // Force refetch by setting a timestamp — screens with useFocusEffect will re-run
        console.log("App returned to foreground");
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <TeamProvider>
            <RootLayoutInner />
          </TeamProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
