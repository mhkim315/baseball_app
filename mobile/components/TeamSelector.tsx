import { View, Text, Pressable, StyleSheet } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { useMemo } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";

interface TeamSelectorProps {
  selectedTeam?: string | null;
  onSelect: (teamId: string) => void;
  title?: string;
}

export default function TeamSelector({ selectedTeam, onSelect, title }: TeamSelectorProps) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: 16,
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.foreground,
      marginBottom: 16,
      textAlign: "center",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
    },
    teamItem: {
      width: 72,
      height: 90,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.card,
      gap: 8,
    },
    teamName: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.mutedForeground,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.grid}>
        {TEAM_LIST.map((team) => {
          const isSelected = selectedTeam === team.id;
          return (
            <Pressable
              key={team.id}
              onPress={() => onSelect(team.id)}
              style={[
                styles.teamItem,
                isSelected && {
                  backgroundColor: teamPrimaryColor(team.id, isDark) + "30",
                  borderColor: teamPrimaryColor(team.id, isDark),
                },
              ]}
            >
              <TeamBadge teamId={team.id} size="md" emotion="default" />
              <Text
                style={[
                  styles.teamName,
                  isSelected && { color: teamPrimaryColor(team.id, isDark), fontWeight: "700" },
                ]}
              >
                {team.shortName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

