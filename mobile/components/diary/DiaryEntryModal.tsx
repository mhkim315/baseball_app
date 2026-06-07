import { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import PhotoCropper from "@/components/PhotoCropper";
import type { JikgwanRecord } from "@/lib/db";
import { useDiaryForm, type GameOption } from "./useDiaryForm";
import DiaryCalendarStep from "./DiaryCalendarStep";
import DiaryGamesStep from "./DiaryGamesStep";
import DiaryWriteStep from "./DiaryWriteStep";

export type { GameOption } from "./useDiaryForm";

interface DiaryEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editRecord?: JikgwanRecord | null;
  presetGame?: GameOption | null;
  presetDate?: Date | null;
}

export default function DiaryEntryModal({ visible, onClose, onSaved, editRecord, presetGame, presetDate }: DiaryEntryModalProps) {
  const form = useDiaryForm({ visible, onClose, onSaved, editRecord, presetGame, presetDate });

  const closeAlert = () => form.setSimpleAlert({ visible: false, title: "", message: "" });

  return (
      <BottomSheet visible={visible} onClose={onClose} swipeToClose hardwareBackPress>
        <View style={form.styles.stepHeader}>
          {form.step === "calendar" && <Text style={form.styles.stepTitle}>날짜 선택</Text>}
          {form.step === "games" && (
            <View style={form.styles.stepBackRow}>
              <Pressable onPress={() => form.setStep("calendar")} hitSlop={8}>
                <Text style={form.styles.backArrow}>◀</Text>
              </Pressable>
              <Text style={form.styles.stepTitle}>{form.dateStrShort} 경기</Text>
              <View style={{ width: 20 }} />
            </View>
          )}
          {form.step === "write" && (
            <View style={form.styles.stepBackRow}>
              <Pressable onPress={() => form.presetGame ? onClose() : form.setStep("games")} hitSlop={8}>
                <Text style={form.styles.backArrow}>◀</Text>
              </Pressable>
              <Text style={form.styles.stepTitle}>{form.editRecord ? "기록 수정" : "기록 작성"}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={form.styles.headerCancelBtn} onPress={onClose} hitSlop={8}>
                  <Text style={form.styles.headerCancelText}>취소</Text>
                </Pressable>
                <Pressable style={form.styles.headerSaveBtn} onPress={form.handleSave} disabled={form.saving}>
                  {form.saving ? (
                    <ActivityIndicator color={form.theme?.background || "#fff"} size="small" />
                  ) : (
                    <Text style={form.styles.headerSaveText}>저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <ScrollView
          ref={form.scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[form.styles.scrollContent, { paddingBottom: 20 + form.keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {form.step === "calendar" && (
            <DiaryCalendarStep
              calYear={form.calYear}
              setCalYear={form.setCalYear}
              calMonth={form.calMonth}
              calPrev={form.calPrev}
              calNext={form.calNext}
              calTranslateX={form.calTranslateX}
              calMonthPanGesture={form.calMonthPanGesture}
              cells={form.cells}
              handleDateSelect={form.handleDateSelect}
              styles={form.styles}
            />
          )}

          {form.step === "games" && (
            <DiaryGamesStep
              games={form.games}
              gamesLoading={form.gamesLoading}
              dateStrShort={form.dateStrShort}
              userTeam={form.userTeam}
              showOtherGames={form.showOtherGames}
              setShowOtherGames={form.setShowOtherGames}
              handleGameSelect={form.handleGameSelect}
              styles={form.styles}
            />
          )}

          {form.step === "write" && (
            <DiaryWriteStep
              selectedGame={form.selectedGame}
              editRecord={form.editRecord}
              cheeredTeam={form.cheeredTeam}
              setCheeredTeam={form.setCheeredTeam}
              emotion={form.emotion}
              setEmotion={form.setEmotion}
              unlockedEmotions={form.unlockedEmotions}
              userTeam={form.userTeam}
              isLive={form.isLive}
              setIsLive={form.setIsLive}
              seat={form.seat}
              setSeat={form.setSeat}
              photoUris={form.photoUris}
              setPhotoUris={form.setPhotoUris}
              content={form.content}
              setContent={form.setContent}
              pendingExpenses={form.pendingExpenses}
              setPendingExpenses={form.setPendingExpenses}
              showExpenseInput={form.showExpenseInput}
              setShowExpenseInput={form.setShowExpenseInput}
              newExpenseCat={form.newExpenseCat}
              setNewExpenseCat={form.setNewExpenseCat}
              newExpenseAmt={form.newExpenseAmt}
              setNewExpenseAmt={form.setNewExpenseAmt}
              newExpenseMemo={form.newExpenseMemo}
              setNewExpenseMemo={form.setNewExpenseMemo}
              allTotems={form.allTotems}
              selectedTotemIds={form.selectedTotemIds}
              setSelectedTotemIds={form.setSelectedTotemIds}
              handleFullGalleryPick={form.handleFullGalleryPick}
              setSimpleAlert={form.setSimpleAlert}
              scrollRef={form.scrollRef}
              dateStrShort={form.dateStrShort}
              styles={form.styles}
            />
          )}
        </ScrollView>

        {form.step !== "write" && (
          <View style={form.styles.bottomRow}>
            {form.step === "games" ? (
              <>
                <Pressable style={form.styles.cancelBtn} onPress={onClose} hitSlop={8}>
                  <Text style={form.styles.cancelText}>취소</Text>
                </Pressable>
                <Pressable style={form.styles.cancelBtn} onPress={() => {
                  form.setSimpleAlert({ visible: true, title: "경기정보 없이 쓰기", message: "경기 정보를 선택하지 않으면 일기에 점수/결과가 표시되지 않습니다. 그래도 진행하시겠습니까?", onOk: () => { form.setSelectedGame(null); form.setStep("write"); } });
                }}>
                  <Text style={form.styles.cancelText}>경기정보 없이 쓰기</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={form.styles.cancelBtnFull} onPress={onClose} hitSlop={8}>
                <Text style={form.styles.cancelText}>취소</Text>
              </Pressable>
            )}
          </View>
        )}
      {form.simpleAlert.visible && (
        <View style={form.styles.alertOverlay}>
          <View style={form.styles.alertCard}>
            <Text style={form.styles.alertTitle}>{form.simpleAlert.title}</Text>
            <Text style={form.styles.alertMessage}>{form.simpleAlert.message}</Text>
            <Pressable style={form.styles.alertOkBtn} onPress={() => {
              closeAlert();
              form.simpleAlert.onOk?.();
            }}>
              <Text style={form.styles.alertOkText}>확인</Text>
            </Pressable>
          </View>
        </View>
      )}

      <PhotoCropper
        visible={!!form.cropUri}
        imageUri={form.cropUri || ""}
        onCrop={(uri: string) => {
          form.croppedUrisRef.current.push(uri);
          form.cropQueueIndexRef.current++;
          if (form.cropQueueIndexRef.current < form.cropQueueRef.current.length) {
            form.setCropUri(form.cropQueueRef.current[form.cropQueueIndexRef.current]);
          } else {
            form.setPhotoUris((prev: string[]) => [...prev, ...form.croppedUrisRef.current]);
            form.setCropUri(null);
            form.cropQueueRef.current = [];
            form.croppedUrisRef.current = [];
          }
        }}
        onCancel={() => {
          form.setCropUri(null);
          form.cropQueueRef.current = [];
          form.cropQueueIndexRef.current = 0;
          form.croppedUrisRef.current = [];
        }}
      />
      </BottomSheet>
  );
}
