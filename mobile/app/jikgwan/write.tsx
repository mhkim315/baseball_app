import { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { TEAM_COLORS } from "@shared/teamColors";
import { DEFAULT_TEAM_ID } from "@shared/constants";
import EmotionPicker from "@/components/EmotionPicker";
import { useTheme } from "@/lib/ThemeContext";
import { addJikgwanRecord, getMyTeam } from "@/lib/db";

export default function JikgwanWriteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    photoUri: string;
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: string;
    awayScore: string;
    stadium: string;
    dateStr: string;
    frameStyle: string;
  }>();

  const [step, setStep] = useState(1);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const dateStr = params.dateStr || `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

  // Auto-complete hints
  const teamNames: string[] = [];
  if (params.awayTeam && TEAM_COLORS[params.awayTeam]) teamNames.push(TEAM_COLORS[params.awayTeam].shortName);
  if (params.homeTeam && TEAM_COLORS[params.homeTeam]) teamNames.push(TEAM_COLORS[params.homeTeam].shortName);

  const hasScore = params.homeScore && params.awayScore;

  const handleNext = () => {
    if (step === 1) {
      if (!emotion) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const myTeam = await getMyTeam();

      // Determine is_win from score + myTeam perspective
      let isWin: number | null = null;
      if (hasScore && myTeam) {
        const homeScore = parseInt(params.homeScore!);
        const awayScore = parseInt(params.awayScore!);
        if (params.homeTeam === myTeam) {
          isWin = homeScore > awayScore ? 1 : homeScore < awayScore ? -1 : 0;
        } else if (params.awayTeam === myTeam) {
          isWin = awayScore > homeScore ? 1 : awayScore < homeScore ? -1 : 0;
        }
      }

      const recordId = await addJikgwanRecord({
        game_id: params.gameId || "",
        date: dateStr,
        photo_path: params.photoUri || null,
        photos: params.photoUri ? JSON.stringify([params.photoUri]) : null,
        memo: null,
        score_away: params.awayScore ? parseInt(params.awayScore) : null,
        score_home: params.homeScore ? parseInt(params.homeScore) : null,
        emotion: emotion,
        three_line_1: line1.trim() || null,
        three_line_2: line2.trim() || null,
        three_line_3: line3.trim() || null,
        frame_style: params.frameStyle || "classic",
        stadium: params.stadium || null,
        is_win: isWin,
        cheered_team: null,
        is_live: 0,
        seat: null,
      });

      if (recordId) {
        Alert.alert("저장 완료", "직관 기록이 저장되었습니다", [
          { text: "확인", onPress: () => router.dismissAll() },
        ]);
      } else {
        throw new Error("save failed");
      }
    } catch {
      Alert.alert("오류", "저장 중 문제가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  // Auto-complete helper
  const getAutoHint = (field: "line1" | "line2" | "line3") => {
    switch (field) {
      case "line1":
        return params.stadium
          ? `${teamNames.join(" ")} 경기, ${params.stadium}에서 직관!`
          : `${teamNames.join(" ")} 경기 직관!`;
      case "line2":
        return hasScore
          ? `${params.awayScore}:${params.homeScore}`
          : "경기 잘 봤다!";
      case "line3":
        return "다음 경기도 직관 가자!";
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
    },
    // Step indicator
    steps: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 60,
      marginBottom: 40,
      gap: 0,
    },
    stepDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.border,
    },
    stepActive: {
      backgroundColor: theme.foreground,
    },
    stepLine: {
      width: 40,
      height: 2,
      backgroundColor: theme.border,
    },
    // Step content
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.foreground,
      textAlign: "center",
    },
    stepSub: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 32,
    },
    // Emotion
    emotionWrapper: {
      marginTop: 20,
    },
    // Input
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
      marginTop: 20,
      marginBottom: 8,
    },
    inputRow: {
      position: "relative",
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
      paddingRight: 50,
      fontSize: 15,
      color: theme.foreground,
      borderWidth: 1,
      borderColor: theme.border,
      lineHeight: 22,
    },
    charCount: {
      position: "absolute",
      bottom: 10,
      right: 12,
      fontSize: 11,
      color: theme.mutedForeground,
    },
    // Buttons
    nextBtn: {
      backgroundColor: theme.foreground,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 32,
    },
    nextBtnDisabled: {
      backgroundColor: theme.muted,
    },
    nextBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.background,
    },
    nextBtnTextDisabled: {
      color: theme.mutedForeground,
    },
    // Confirm step
    confirmCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      marginTop: 20,
      gap: 12,
    },
    confirmEmotion: {
      alignItems: "center",
      gap: 4,
    },
    confirmEmoji: {
      fontSize: 40,
    },
    confirmEmotionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
    },
    confirmDivider: {
      height: 1,
      backgroundColor: theme.border,
    },
    confirmDiary: {
      gap: 6,
    },
    confirmLine: {
      fontSize: 14,
      color: theme.foreground,
      lineHeight: 20,
    },
    confirmGame: {
      alignItems: "center",
      gap: 4,
    },
    confirmGameText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
    },
    confirmScore: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.foreground,
    },
    confirmStadium: {
      fontSize: 12,
      color: theme.mutedForeground,
    },
    confirmActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    backBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    backBtnText: {
      fontSize: 16,
      color: theme.foreground,
      fontWeight: "600",
    },
    saveBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: theme.foreground,
      alignItems: "center",
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.background,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.steps}>
        <View style={[styles.stepDot, step >= 1 && styles.stepActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.stepActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepActive]} />
        <View style={[styles.stepLine, step >= 3 && styles.stepActive]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepActive]} />
      </View>

      {/* Step 1: Emotion */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>오늘 경기 어땠나요?</Text>
          <Text style={styles.stepSub}>기분을 선택해주세요</Text>
          <View style={styles.emotionWrapper}>
            <EmotionPicker value={emotion} onChange={setEmotion} teamId={params.awayTeam || params.homeTeam || DEFAULT_TEAM_ID} />
          </View>
          <Pressable
            style={[styles.nextBtn, !emotion && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!emotion}
          >
            <Text style={[styles.nextBtnText, !emotion && styles.nextBtnTextDisabled]}>다음</Text>
          </Pressable>
        </View>
      )}

      {/* Step 2: Three-line diary */}
      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>기록을 남겨보세요</Text>

          <Text style={styles.fieldLabel}>💭 오늘의 감정</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={line1}
              onChangeText={setLine1}
              placeholder={getAutoHint("line1")}
              placeholderTextColor="#999"
              maxLength={30}
              multiline
            />
            <Text style={styles.charCount}>{line1.length}/30</Text>
          </View>

          <Text style={styles.fieldLabel}>📝 있었던 일</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={line2}
              onChangeText={setLine2}
              placeholder={getAutoHint("line2")}
              placeholderTextColor="#999"
              maxLength={50}
              multiline
            />
            <Text style={styles.charCount}>{line2.length}/50</Text>
          </View>

          <Text style={styles.fieldLabel}>🌟 내일의 다짐</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={line3}
              onChangeText={setLine3}
              placeholder={getAutoHint("line3")}
              placeholderTextColor="#999"
              maxLength={30}
              multiline
            />
            <Text style={styles.charCount}>{line3.length}/30</Text>
          </View>

          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>다음</Text>
          </Pressable>
        </View>
      )}

      {/* Step 3: Confirm & Save */}
      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>기록 확인</Text>

          {/* Summary card */}
          <View style={styles.confirmCard}>
            <View style={styles.confirmEmotion}>
              <Text style={styles.confirmEmoji}>
                {emotion === "excited" ? "😆" :
                 emotion === "happy" ? "🤩" :
                 emotion === "neutral" ? "😐" :
                 emotion === "sad" ? "😢" : "😤"}
              </Text>
              <Text style={styles.confirmEmotionLabel}>
                {emotion === "excited" ? "신나" :
                 emotion === "happy" ? "최고" :
                 emotion === "neutral" ? "보통" :
                 emotion === "sad" ? "아쉬워" : "화나"}
              </Text>
            </View>

            <View style={styles.confirmDivider} />

            <View style={styles.confirmDiary}>
              {line1 ? <Text style={styles.confirmLine}>💭 {line1}</Text> : null}
              {line2 ? <Text style={styles.confirmLine}>📝 {line2}</Text> : null}
              {line3 ? <Text style={styles.confirmLine}>🌟 {line3}</Text> : null}
            </View>

            {(teamNames.length > 0 || hasScore) && (
              <>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmGame}>
                  {teamNames.length > 0 && (
                    <Text style={styles.confirmGameText}>{teamNames.join(" vs ")}</Text>
                  )}
                  {hasScore && (
                    <Text style={styles.confirmScore}>{params.awayScore}:{params.homeScore}</Text>
                  )}
                  {params.stadium && (
                    <Text style={styles.confirmStadium}>{params.stadium}</Text>
                  )}
                </View>
              </>
            )}
          </View>

          <View style={styles.confirmActions}>
            <Pressable
              style={styles.backBtn}
              onPress={() => setStep(2)}
            >
              <Text style={styles.backBtnText}>수정</Text>
            </Pressable>
            <Pressable
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>저장하기</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

