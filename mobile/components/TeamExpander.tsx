import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { TEAM_COLORS, TEAM_LIST } from "@shared/teamColors";
import { TeamBadge } from "@/components/TeamBadge";
import { theme } from "@/lib/theme";

interface TeamExpanderProps {
  currentTeamId: string;
  onSelectTeam: (teamId: string) => void;
}

export default function TeamExpander({ currentTeamId, onSelectTeam }: TeamExpanderProps) {
  const [open, setOpen] = useState(false);
  const currentTeam = TEAM_COLORS[currentTeamId];

  const handleSelect = (teamId: string) => {
    onSelectTeam(teamId);
    setOpen(false);
  };

  return (
    <View>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <TeamBadge teamId={currentTeamId} size="sm" />
        <Text style={[styles.teamName, { color: currentTeam?.primary }]}>
          {currentTeam?.shortName || ""}
        </Text>
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>다른 팀 정보 보기</Text>
            {TEAM_LIST.map((team) => (
              <Pressable
                key={team.id}
                style={[
                  styles.teamRow,
                  team.id === currentTeamId && styles.teamRowActive,
                ]}
                onPress={() => handleSelect(team.id)}
              >
                <TeamBadge teamId={team.id} size="md" />
                <Text style={[
                  styles.teamRowName,
                  { color: team.primary },
                  team.id === currentTeamId && { fontWeight: "700" },
                ]}>
                  {team.name}
                </Text>
                {team.id === currentTeamId && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </Pressable>
            ))}
            <Text style={styles.dropdownHint}>
              팀 변경은 MY 페이지에서 할 수 있습니다
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  teamName: {
    fontSize: 14,
    fontWeight: "600",
  },
  arrow: {
    fontSize: 8,
    color: theme.mutedForeground,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dropdown: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 320,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.foreground,
    textAlign: "center",
    marginBottom: 16,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  teamRowActive: {
    backgroundColor: theme.secondary,
  },
  teamRowName: {
    fontSize: 14,
    flex: 1,
  },
  checkMark: {
    fontSize: 16,
    color: theme.foreground,
    fontWeight: "700",
  },
  dropdownHint: {
    fontSize: 11,
    color: theme.mutedForeground,
    textAlign: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
