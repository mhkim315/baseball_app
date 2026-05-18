import { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getMyTeam } from "@/lib/db";
import { useTheme } from "@/lib/ThemeContext";

export default function IndexScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    getMyTeam().then((team) => {
      router.replace(team ? "/(tabs)/home" : "/onboarding");
    });
  }, [router]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
  }), [theme]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.foreground} />
    </View>
  );
}
