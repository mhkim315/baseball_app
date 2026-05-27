import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "@/lib/ThemeContext";

export function useStadiumStyles() {
  const { theme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.foreground },
    loadingRow: { paddingVertical: 60, alignItems: "center" },
    errorText: { color: theme.mutedForeground, fontSize: 14, marginBottom: 16 },
    retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: theme.foreground, borderRadius: 16 },
    retryText: { color: theme.background, fontSize: 13, fontWeight: "600" },

    teamGrid: {
      flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
      paddingHorizontal: 12, gap: 8, marginBottom: 8,
    },
    teamItem: {
      width: 68, height: 80, justifyContent: "center", alignItems: "center",
      borderRadius: 14, borderWidth: 2, borderColor: theme.border,
      backgroundColor: theme.card, gap: 6,
    },
    teamName: { fontSize: 11, fontWeight: "600", color: theme.mutedForeground },

    teamBar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: theme.card, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border,
    },
    teamBarInfo: { flex: 1 },
    teamBarName: { fontSize: 16, fontWeight: "700", color: theme.foreground },
    teamBarStadium: { fontSize: 12, color: theme.mutedForeground, marginTop: 2 },

    tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 8 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
    tabText: { fontSize: 12, color: theme.mutedForeground, fontWeight: "500" },
    tabContent: { padding: 16, gap: 12, paddingBottom: 40 },

    infoCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, alignItems: "flex-start" },
    infoLabel: { fontSize: 13, color: theme.mutedForeground, width: 70 },
    infoValue: { fontSize: 13, color: theme.foreground, flex: 1, textAlign: "right" },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.foreground, flex: 1 },
    sectionHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    sectionArrow: { fontSize: 10, color: theme.mutedForeground, marginLeft: 8 },

    imageCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
    imageCardTitle: { fontSize: 14, fontWeight: "600", color: theme.foreground, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    seatImage: { width: "100%", height: 200 },

    tierBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
    tierRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tierName: { fontSize: 13, color: theme.foreground, fontWeight: "500", flex: 1 },
    tierDetail: { fontSize: 12, color: theme.mutedForeground },
    tierMeta: { flexDirection: "row", gap: 8, marginTop: 4 },
    tierMetaText: { fontSize: 11, color: theme.secondaryForeground },
    tierNote: { fontSize: 11, color: theme.mutedForeground, marginTop: 4, lineHeight: 15 },
    ticketNote: { fontSize: 11, color: theme.mutedForeground, marginTop: 8, lineHeight: 16 },

    filterRow: { marginVertical: 2 },
    floorChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginRight: 8 },
    floorChipText: { fontSize: 12, color: theme.mutedForeground },
    catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
    catChipInactive: { backgroundColor: theme.muted },
    catChipText: { fontSize: 12, fontWeight: "500" },
    catChipTextActive: { color: theme.background, fontWeight: "700" },
    catChipTextInactive: { color: theme.mutedForeground },

    foodMapOuter: {
      backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
      overflow: "hidden",
    },
    foodMapImgWrap: {
      width: "100%", position: "relative",
      overflow: "hidden",
    },

    shopDetail: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16 },
    shopDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    shopDetailName: { fontSize: 14, fontWeight: "700", color: theme.foreground },
    shopDetailBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    shopDetailBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600" },
    shopDetailMenu: { fontSize: 12, color: theme.secondaryForeground, marginBottom: 4, lineHeight: 18 },
    shopDetailLoc: { fontSize: 11, color: theme.mutedForeground, marginTop: 2 },

    foodChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    foodChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
      backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    },
    foodChipDot: { width: 8, height: 8, borderRadius: 4 },
    foodChipText: { fontSize: 11, fontWeight: "500", color: theme.foreground },

    spotName: { fontSize: 14, fontWeight: "600", color: theme.foreground },
    spotDesc: { fontSize: 13, color: theme.secondaryForeground, marginTop: 4, lineHeight: 18 },
    mapLink: { marginTop: 8 },
    mapLinkText: { fontSize: 13, color: theme.info, fontWeight: "500" },

    transitBlock: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    transitIcon: { fontSize: 20 },
    transitLabel: { fontSize: 12, fontWeight: "600", color: theme.foreground, marginBottom: 2 },
    transitValue: { fontSize: 13, color: theme.secondaryForeground, lineHeight: 18 },

    nearbyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    nearbySectionTitle: { fontSize: 14, fontWeight: "700", color: theme.foreground, marginBottom: 4, marginTop: 8 },
    nearbyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    nearbyBadgeText: { fontSize: 10, fontWeight: "600", color: "#fff" },
    phoneText: { fontSize: 13, color: theme.info, marginTop: 4 },

    emptyCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 32, alignItems: "center" },
    emptyText: { fontSize: 13, color: theme.mutedForeground },
  }), [theme]);
  return styles;
}
