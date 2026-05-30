import { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTeam } from "@/lib/TeamContext";
import { useTheme } from "@/lib/ThemeContext";
import { prefetchOnboardingData, prefetchOnAppInit } from "@/lib/prefetch";

export default function IndexScreen() {
  const { theme } = useTheme();
  const { myTeam, loading } = useTeam();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!myTeam) {
      prefetchOnboardingData().finally(() => {
        router.replace("/onboarding");
      });
    } else {
      prefetchOnAppInit();
      router.replace("/(tabs)/home");
    }
  }, [myTeam, loading, router]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
  }), [theme]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.foreground} />
    </View>
  );
}
