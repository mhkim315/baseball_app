import { View, Text, Pressable, TextInput } from "react-native";
import { TEAM_COLORS } from "@shared/teamColors";
import { parseGameTeamIds } from "@shared/constants";
import { TeamBadge } from "@/components/TeamBadge";
import EmotionPicker from "@/components/EmotionPicker";
import { useTheme, teamPrimaryColor } from "@/lib/ThemeContext";
import type { JikgwanRecord } from "@/lib/db";
import type { GameOption } from "./useDiaryForm";
import type { ExpenseCategory } from "@/lib/db";
import DiaryPhotoGrid from "./DiaryPhotoGrid";
import DiaryExpenseList from "./DiaryExpenseList";
import DiaryTotemPicker from "./DiaryTotemPicker";

export default function DiaryWriteStep({ selectedGame, editRecord, cheeredTeam, setCheeredTeam, emotion, setEmotion, unlockedEmotions, userTeam, isLive, setIsLive, seat, setSeat, photoUris, setPhotoUris, content, setContent, pendingExpenses, setPendingExpenses, showExpenseInput, setShowExpenseInput, newExpenseCat, setNewExpenseCat, newExpenseAmt, setNewExpenseAmt, newExpenseMemo, setNewExpenseMemo, allTotems, selectedTotemIds, setSelectedTotemIds, handleFullGalleryPick, setSimpleAlert, scrollRef, dateStrShort, styles }: {
  selectedGame: GameOption | null;
  editRecord?: JikgwanRecord | null;
  cheeredTeam: string | null;
  setCheeredTeam: React.Dispatch<React.SetStateAction<string | null>>;
  emotion: string | null;
  setEmotion: React.Dispatch<React.SetStateAction<string | null>>;
  unlockedEmotions: string[];
  userTeam: string;
  isLive: boolean;
  setIsLive: React.Dispatch<React.SetStateAction<boolean>>;
  seat: string;
  setSeat: React.Dispatch<React.SetStateAction<string>>;
  photoUris: string[];
  setPhotoUris: React.Dispatch<React.SetStateAction<string[]>>;
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  pendingExpenses: { category: ExpenseCategory; amount: string; memo: string }[];
  setPendingExpenses: React.Dispatch<React.SetStateAction<{ category: ExpenseCategory; amount: string; memo: string }[]>>;
  showExpenseInput: boolean;
  setShowExpenseInput: React.Dispatch<React.SetStateAction<boolean>>;
  newExpenseCat: ExpenseCategory;
  setNewExpenseCat: React.Dispatch<React.SetStateAction<ExpenseCategory>>;
  newExpenseAmt: string;
  setNewExpenseAmt: React.Dispatch<React.SetStateAction<string>>;
  newExpenseMemo: string;
  setNewExpenseMemo: React.Dispatch<React.SetStateAction<string>>;
  allTotems: import("@/lib/db").Totem[];
  selectedTotemIds: number[];
  setSelectedTotemIds: React.Dispatch<React.SetStateAction<number[]>>;
  handleFullGalleryPick: () => void;
  setSimpleAlert: React.Dispatch<React.SetStateAction<{ visible: boolean; title: string; message: string; onOk?: () => void }>>;
  scrollRef: any;
  dateStrShort: string;
  styles: Record<string, any>;
}) {
  const { theme, isDark } = useTheme();

  return (
    <View>
      {selectedGame && (
        <View style={styles.selectedGameBanner}>
          <TeamBadge teamId={selectedGame.awayTeam} size="sm" />
          <Text style={styles.selectedGameText}>
            {TEAM_COLORS[selectedGame.awayTeam]?.shortName} VS {TEAM_COLORS[selectedGame.homeTeam]?.shortName}
          </Text>
          <TeamBadge teamId={selectedGame.homeTeam} size="sm" />
        </View>
      )}

      {(() => {
        let awayId = selectedGame?.awayTeam || "";
        let homeId = selectedGame?.homeTeam || "";
        if (!awayId && !homeId && editRecord?.game_id) {
          const gt = parseGameTeamIds(editRecord.game_id);
          awayId = gt.awayId;
          homeId = gt.homeId;
        }
        if (!awayId || !homeId) return null;

        const ac = TEAM_COLORS[awayId];
        const hc = TEAM_COLORS[homeId];
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>응원팀</Text>
            <View style={styles.editGameRow}>
              <Pressable
                style={[styles.cheerTeamCard, cheeredTeam === awayId && { borderColor: teamPrimaryColor(awayId, isDark) || theme.muted, borderWidth: 2 }]}
                onPress={() => setCheeredTeam(cheeredTeam === awayId ? null : awayId)}
              >
                <TeamBadge teamId={awayId} size="sm" />
                <Text style={[styles.cheerTeamName, { color: teamPrimaryColor(awayId, isDark) }]}>{ac?.shortName || "?"}</Text>
                {cheeredTeam === awayId && <Text style={styles.cheerTeamBadge}>✓</Text>}
              </Pressable>
              <Text style={styles.gameVs}>VS</Text>
              <Pressable
                style={[styles.cheerTeamCard, cheeredTeam === homeId && { borderColor: teamPrimaryColor(homeId, isDark) || "#333", borderWidth: 2 }]}
                onPress={() => setCheeredTeam(cheeredTeam === homeId ? null : homeId)}
              >
                <TeamBadge teamId={homeId} size="sm" />
                <Text style={[styles.cheerTeamName, { color: teamPrimaryColor(homeId, isDark) }]}>{hc?.shortName || "?"}</Text>
                {cheeredTeam === homeId && <Text style={styles.cheerTeamBadge}>✓</Text>}
              </Pressable>
            </View>
          </View>
        );
      })()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>오늘의 기분</Text>
        <EmotionPicker value={emotion} onChange={setEmotion} teamId={cheeredTeam || userTeam} unlockedEmotions={unlockedEmotions} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>시청 방식</Text>
        <View style={styles.liveToggleRow}>
          <Pressable
            style={[styles.liveToggleBtn, isLive && { backgroundColor: teamPrimaryColor(userTeam, isDark) || theme.foreground }]}
            onPress={() => setIsLive(true)}
          >
            <Text style={[styles.liveToggleText, isLive && { color: "#fff" }]}>직관</Text>
          </Pressable>
          <Pressable
            style={[styles.liveToggleBtn, !isLive && { backgroundColor: "#888" }]}
            onPress={() => setIsLive(false)}
          >
            <Text style={[styles.liveToggleText, !isLive && { color: "#fff" }]}>집관</Text>
          </Pressable>
        </View>
      </View>

      {isLive && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>좌석 (선택)</Text>
          <TextInput
            style={styles.seatInput}
            value={seat}
            onChangeText={setSeat}
            placeholder="예: 1루 5열 12번"
            placeholderTextColor={theme.mutedForeground}
          />
        </View>
      )}

      <View style={styles.section}>
        <DiaryPhotoGrid
          photoUris={photoUris}
          onRemove={(i) => setPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
          onAdd={handleFullGalleryPick}
          styles={styles}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>직관일기</Text>
        <TextInput
          style={styles.diaryInput}
          value={content}
          onChangeText={setContent}
          placeholder={`${dateStrShort}의 직관 이야기를 자유롭게 적어보세요 :)`}
          placeholderTextColor={theme.mutedForeground}
          multiline
          textAlignVertical="top"
          onFocus={() => requestAnimationFrame(() => scrollRef?.current?.scrollToEnd?.({ animated: true }))}
        />
      </View>

      <View style={styles.section}>
        <DiaryExpenseList
          pendingExpenses={pendingExpenses}
          setPendingExpenses={setPendingExpenses}
          showExpenseInput={showExpenseInput}
          setShowExpenseInput={setShowExpenseInput}
          newExpenseCat={newExpenseCat}
          setNewExpenseCat={setNewExpenseCat}
          newExpenseAmt={newExpenseAmt}
          setNewExpenseAmt={setNewExpenseAmt}
          newExpenseMemo={newExpenseMemo}
          setNewExpenseMemo={setNewExpenseMemo}
          setSimpleAlert={setSimpleAlert}
          styles={styles}
        />
      </View>

      <View style={styles.section}>
        <DiaryTotemPicker
          allTotems={allTotems}
          selectedTotemIds={selectedTotemIds}
          setSelectedTotemIds={setSelectedTotemIds}
          theme={theme}
        />
      </View>
    </View>
  );
}
