import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import { useTeam } from "@/lib/TeamContext";

const ICON_PATHS: Record<string, string> = {
  홈: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z", // house
  구장: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", // map pin
  다이어리: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h5v16z", // book
  응원: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z", // music note
  순위: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z", // bar chart
};

function TabIcon({ name, color }: { name: string; color: string }) {
  const d = ICON_PATHS[name] || ICON_PATHS.홈;
  return (
    <View style={styles.tabIcon}>
      <Svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
        <Path d={d} />
      </Svg>
    </View>
  );
}

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const { myTeam } = useTeam();

  const activeColor = myTeam ? teamPrimaryColor(myTeam, isDark) : theme.tabBarActive;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: activeColor,
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
          tabBarIcon: ({ color }) => <TabIcon name="홈" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stadium"
        options={{
          title: "구장 안내",
          tabBarIcon: ({ color }) => <TabIcon name="구장" color={color} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "다이어리",
          tabBarIcon: ({ color }) => <TabIcon name="다이어리" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cheer"
        options={{
          title: "응원",
          tabBarIcon: ({ color }) => <TabIcon name="응원" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rank"
        options={{
          title: "순위",
          tabBarIcon: ({ color }) => <TabIcon name="순위" color={color} />,
        }}
      />
      <Tabs.Screen name="my" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: "center",
  },
});
