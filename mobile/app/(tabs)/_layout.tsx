import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    홈: "🏠",
    구장: "🏟️",
    다이어리: "📖",
    응원: "🎵",
    MY: "👤",
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {icons[label] || "•"}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => <TabIcon label="홈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stadium"
        options={{
          title: "구장",
          tabBarIcon: ({ focused }) => <TabIcon label="구장" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "다이어리",
          tabBarIcon: ({ focused }) => <TabIcon label="다이어리" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cheer"
        options={{
          title: "응원",
          tabBarIcon: ({ focused }) => <TabIcon label="응원" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: "MY",
          tabBarIcon: ({ focused }) => <TabIcon label="MY" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: "center",
  },
  tabIconText: {
    fontSize: 20,
  },
  tabIconFocused: {
    opacity: 1,
  },
});
