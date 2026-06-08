import { useState, useMemo, useRef, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Image, ActivityIndicator } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import SimpleAlert from "@/components/SimpleAlert";
import { useTheme } from "@/lib/ThemeContext";
import { TICKET_PRICES } from "@/lib/ticketPrices";
import { TEAM_COLORS } from "@shared/teamColors";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system";
import { WebView } from "react-native-webview";

const REPORT_URL = "https://report.prosports.or.kr/report/";
const STITCH_W = 1080;

type Step = "team" | "seats" | "photos";

interface TeamOption {
  teamId: string;
  teamName: string;
  hexColor: string;
}

const TEAMS: TeamOption[] = Object.entries(TICKET_PRICES).map(([id, data]) => ({
  teamId: id,
  teamName: data.teamName,
  hexColor: TEAM_COLORS[id]?.primary || "#666",
}));

function buildCombineHtml(rawBase64List: string[]): string {
  const items = rawBase64List.map((b) => `'data:image/png;base64,${b.replace(/[\r\n]/g, "")}'`);
  return `<!DOCTYPE html><html><body style="margin:0"><canvas id="c"></canvas><script>
var d=[${items.join(",")}];
Promise.all(d.map(function(u){return new Promise(function(r,e){
var img=new Image();img.onload=function(){r(img)};img.onerror=function(){e("img_load")};img.src=u
})})).then(function(imgs){
var c=document.getElementById("c"),ctx=c.getContext("2d"),W=${STITCH_W},h=0,i,ih;
for(i=0;i<imgs.length;i++)h+=imgs[i].height/imgs[i].width*W;
c.width=W;c.height=Math.ceil(h);var y=0;
for(i=0;i<imgs.length;i++){ih=imgs[i].height/imgs[i].width*W;ctx.drawImage(imgs[i],0,y,W,ih);y+=ih}
window.ReactNativeWebView.postMessage(c.toDataURL("image/png"));
}).catch(function(e){window.ReactNativeWebView.postMessage("ERROR:"+e)});
</script></body></html>`;
}

export default function TicketReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>("team");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [combinedUri, setCombinedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sa, setSa] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: "", message: "" });
  const base64Ref = useRef<string[]>([]);

  const teamData = selectedTeam ? TICKET_PRICES[selectedTeam] : null;

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedTier(0);
    setStep("seats");
  };

  const handleBack = () => {
    setStep("team");
    setSelectedTeam(null);
  };

  const handleReport = () => {
    Linking.openURL(REPORT_URL);
  };

  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setSa({ visible: true, title: "권한 필요", message: "앨범 접근 권한이 필요합니다." });
      return;
    }
    const remain = 4 - selectedPhotos.length;
    if (remain <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remain,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a) => a.uri);
      setSelectedPhotos((prev) => [...prev, ...newUris].slice(0, 4));
      setCombinedUri(null);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
    setCombinedUri(null);
  };

  const handleCombinePhotos = async () => {
    if (selectedPhotos.length === 0) return;
    setProcessing(true);

    try {
      const resized = await Promise.all(
        selectedPhotos.map((uri) =>
          manipulateAsync(uri, [{ resize: { width: STITCH_W } }], { format: SaveFormat.PNG })
        )
      );
      const base64List = await Promise.all(
        resized.map((r) => new File(r.uri).base64())
      );
      base64Ref.current = base64List;
      setProcessing(false);
      setCombinedUri("__webview__");
    } catch (e) {
      console.error(e);
      setProcessing(false);
      setSa({ visible: true, title: "오류", message: "이미지 처리 중 오류가 발생했습니다." });
    }
  };

  const handleWebViewMessage = useCallback(async (event: any) => {
    const data = event.nativeEvent.data;
    if (data.startsWith("ERROR:")) {
      setSa({ visible: true, title: "오류", message: data });
      setCombinedUri(null);
      return;
    }
    try {
      const raw = data.split(",")[1];
      const outFile = new File(Paths.cache, `sr_${Date.now()}.png`);
      outFile.create({ overwrite: true });
      outFile.write(raw, { encoding: "base64" });
      setCombinedUri(outFile.uri);
      base64Ref.current = [];
    } catch (e: any) {
      console.error(e);
      setSa({ visible: true, title: "오류", message: "저장 실패: " + (e?.message || "") });
      setCombinedUri(null);
    }
  }, []);

  const handleSave = async () => {
    if (!combinedUri || combinedUri.startsWith("__")) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") {
        setSa({ visible: true, title: "권한 필요", message: "갤러리 저장 권한이 필요합니다." });
        setSaving(false);
        return;
      }
      await MediaLibrary.createAssetAsync(combinedUri);
      setSa({ visible: true, title: "저장 완료", message: "갤러리에 저장되었습니다." });
    } catch (e) {
      console.error(e);
      setSa({ visible: true, title: "오류", message: "갤러리 저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  // Group seats by category
  const groupedSeats = useMemo(() => {
    if (!teamData) return [];
    const groups = new Map<string, typeof teamData.seats>();
    for (const seat of teamData.seats) {
      const existing = groups.get(seat.category) || [];
      existing.push(seat);
      groups.set(seat.category, existing);
    }
    return [...groups.entries()];
  }, [teamData]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    backBtn: {
      paddingVertical: 6,
      paddingRight: 12,
    },
    backText: {
      fontSize: 16,
      fontWeight: "600",
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "center",
      flex: 1,
    },
    subtitle: {
      fontSize: 12,
      color: theme.mutedForeground,
      textAlign: "center",
      marginBottom: 20,
    },

    // Team list
    teamItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
      backgroundColor: theme.card,
    },
    teamDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 12,
    },
    teamName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.foreground,
    },

    // Tier tabs
    tierRow: {
      flexDirection: "row",
      gap: 6,
    },
    tierTab: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    tierTabText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.mutedForeground,
      lineHeight: 18,
    },

    // Seats
    categoryGroup: {
      marginBottom: 20,
    },
    categoryTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.mutedForeground,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    seatItem: {
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      marginBottom: 6,
    },
    seatNameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    seatName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground,
      flex: 1,
    },
    seatNote: {
      fontSize: 11,
      color: theme.mutedForeground,
    },

    // Photo section in seats step
    photoSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    photoSectionBtn: {
      justifyContent: "center",
    },

    // Photo grid
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginVertical: 12,
    },
    photoThumbWrap: {
      width: "48%",
      aspectRatio: 1,
      borderRadius: 10,
      overflow: "hidden",
    },
    photoThumb: {
      width: "100%",
      height: "100%",
    },
    photoRemoveBtn: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    photoRemoveText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 15,
    },

    // Combined result
    combinedPreview: {
      width: "100%",
      height: 220,
      borderRadius: 10,
      backgroundColor: theme.border,
    },

    // Report button
    reportBtn: {
      backgroundColor: theme.destructive || "#e53935",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
    },
    reportBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },

    pickerBtn: {
      flexDirection: "row",
      justifyContent: "center",
      borderStyle: "dashed",
    },
  }), [theme]);

  const teamColor = selectedTeam ? (TEAM_COLORS[selectedTeam]?.primary || theme.primary) : theme.primary;
  const wvBusy = combinedUri === "__webview__";

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="92%" fillHeight>
      <View style={styles.container}>
        {step === "team" ? (
          <>
            <Text style={[styles.title, { color: theme.foreground }]}>암표 신고</Text>
            <Text style={styles.subtitle}>
              관람한 경기 구단을 선택한 후{'\n'}앉았던 좌석의 정가를 확인하세요
            </Text>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {TEAMS.map((team) => (
                <Pressable
                  key={team.teamId}
                  style={styles.teamItem}
                  onPress={() => handleSelectTeam(team.teamId)}
                >
                  <View style={[styles.teamDot, { backgroundColor: team.hexColor }]} />
                  <Text style={styles.teamName}>{team.teamName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : step === "seats" ? (
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <Text style={[styles.backText, { color: teamColor }]}>← 뒤로</Text>
              </Pressable>
              <Text style={[styles.headerTitle, { color: theme.foreground }]}>
                {teamData?.teamName || ""}
              </Text>
              <View style={{ width: 50 }} />
            </View>
            {teamData && teamData.tierNames.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tierRow}>
                    {teamData.tierNames.map((tier, ti) => (
                      <Pressable
                        key={ti}
                        onPress={() => setSelectedTier(ti)}
                        style={[
                          styles.tierTab,
                          selectedTier === ti && {
                            borderColor: teamColor,
                            backgroundColor: teamColor + "18",
                          },
                        ]}
                      >
                        <Text style={[
                          styles.tierTabText,
                          selectedTier === ti && { color: teamColor },
                        ]}>
                          {tier}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {groupedSeats.map(([category, seats]) => (
                <View key={category} style={styles.categoryGroup}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {seats.map((seat, i) => {
                    const price = seat.prices[selectedTier] ?? 0;
                    const priceStr = price > 0 ? `${price.toLocaleString()}원` : "무료";
                    return (
                      <View key={i} style={styles.seatItem}>
                        <View style={styles.seatNameRow}>
                          <Text style={styles.seatName}>{seat.name}</Text>
                          {seat.note && <Text style={styles.seatNote}>{seat.note}</Text>}
                        </View>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: teamColor,
                          marginTop: 4,
                        }}>
                          {priceStr}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={styles.photoSection}>
                <Text style={[styles.categoryTitle, { color: theme.foreground, marginBottom: 12 }]}>
                  증빙사진 첨부
                </Text>
                <Pressable
                  onPress={() => setStep("photos")}
                  style={[styles.teamItem, styles.photoSectionBtn]}
                >
                  <Text style={[styles.teamName, { color: theme.foreground }]}>
                    {selectedPhotos.length > 0
                      ? `사진 ${selectedPhotos.length}장 선택됨 >`
                      : "증빙사진 선택하기 >"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
            <Pressable style={styles.reportBtn} onPress={handleReport}>
              <Text style={styles.reportBtnText}>프로스포츠협회 신고 바로가기</Text>
            </Pressable>
          </>
        ) : (
          /* Photos step */
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setStep("seats")} style={styles.backBtn}>
                <Text style={[styles.backText, { color: teamColor }]}>← 뒤로</Text>
              </Pressable>
              <Text style={[styles.headerTitle, { color: theme.foreground }]}>
                증빙사진 첨부
              </Text>
              <View style={{ width: 50 }} />
            </View>

            <Text style={styles.subtitle}>
              증빙사진을 첨부하면 신고에 도움이 됩니다.{'\n'}사진은 최대 4장까지 선택 가능합니다.
            </Text>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {selectedPhotos.length < 4 && !wvBusy && !combinedUri && (
                <Pressable
                  onPress={handlePickPhotos}
                  style={[styles.teamItem, styles.pickerBtn]}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.mutedForeground }}>
                    + 사진 선택 ({selectedPhotos.length}/4)
                  </Text>
                </Pressable>
              )}

              {selectedPhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {selectedPhotos.map((uri, i) => (
                    <View key={i} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                      {!wvBusy && !combinedUri && (
                        <Pressable style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(i)}>
                          <Text style={styles.photoRemoveText}>X</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {selectedPhotos.length > 0 && !processing && !wvBusy && !combinedUri && (
                <Pressable style={[styles.reportBtn, { backgroundColor: teamColor }]} onPress={handleCombinePhotos}>
                  <Text style={styles.reportBtnText}>이미지 이어붙이기</Text>
                </Pressable>
              )}

              {/* WebView busy */}
              {wvBusy && (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <ActivityIndicator size="large" color={teamColor} />
                  <Text style={{ marginTop: 12, fontSize: 14, color: theme.mutedForeground }}>
                    이미지 합치는 중...
                  </Text>
                </View>
              )}

              {/* Result */}
              {combinedUri && !wvBusy && (
                <View style={{ marginVertical: 12 }}>
                  <Text style={[styles.categoryTitle, { color: theme.foreground, marginBottom: 8 }]}>
                    이어붙이기 완료
                  </Text>
                  <Image source={{ uri: combinedUri }} style={styles.combinedPreview} resizeMode="contain" />
                  <Pressable
                    style={[styles.reportBtn, { backgroundColor: teamColor, marginTop: 12, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.reportBtnText}>갤러리에 저장</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.reportBtn, { backgroundColor: theme.card, marginTop: 8, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => { setSelectedPhotos([]); setCombinedUri(null); }}
                  >
                    <Text style={[styles.reportBtnText, { color: theme.foreground }]}>새로 만들기</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <Pressable style={styles.reportBtn} onPress={handleReport}>
              <Text style={styles.reportBtnText}>프로스포츠협회 신고 바로가기</Text>
            </Pressable>

            {/* Hidden WebView for canvas stitching */}
            {wvBusy && (
              <WebView
                style={{ width: 1, height: 1 }}
                originWhitelist={["*"]}
                source={{ html: buildCombineHtml(base64Ref.current) }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled
              />
            )}
          </>
        )}
      </View>
      <SimpleAlert
        visible={sa.visible}
        title={sa.title}
        message={sa.message}
        onClose={() => setSa((p) => ({ ...p, visible: false }))}
        onConfirm={() => setSa((p) => ({ ...p, visible: false }))}
      />
    </BottomSheet>
  );
}
