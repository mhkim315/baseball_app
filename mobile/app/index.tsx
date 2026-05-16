import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getMyTeam } from "@/lib/db";
import { theme } from "@/lib/theme";

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    getMyTeam().then((team) => {
      router.replace(team ? "/(tabs)" : "/onboarding");
    });
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
});
