import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHORT_CODE_TO_NAME } from '@/lib/teamStorage';

// 앱이 포그라운드에 있을 때도 알림을 보여줄지 결정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 무음 알림 채널 세팅
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('live_game_channel', {
      name: '실시간 야구 점수',
      importance: Notifications.AndroidImportance.LOW, // 소리/진동 없음
      vibrationPattern: [0, 0, 0, 0],
    });
  }
}

// 실시간 점수 덮어쓰기 (다이나믹 아일랜드 효과)
export async function updateLockScreenScore(data: Record<string, string>) {
  if (!data || data.type !== 'game_update' || data.status !== 'live') return;

  const awayName = data.away_name || SHORT_CODE_TO_NAME[data.away_team || ""] || data.away_team || "";
  const homeName = data.home_name || SHORT_CODE_TO_NAME[data.home_team || ""] || data.home_team || "";
  const event = data.event || "";
  const inningStr = data.inning ? `${data.inning}회${data.is_top === '1' ? '초' : '말'}` : '';
  const pitcher = data.current_pitcher || "";
  const batter = data.current_batter || "";

  let title: string;
  let body: string;

  if (event === "score") {
    const who = data.scoring_team ? `${data.scoring_team} ` : "";
    title = `⚾ ${who}득점! ${awayName} ${data.away_score} : ${data.home_score} ${homeName}`;
    body = `${inningStr} | 투수 ${pitcher || '?'} | 타자 ${batter || '?'}`;
  } else {
    title = `⚾ ${inningStr} 시작 | ${awayName} ${data.away_score} : ${data.home_score} ${homeName}`;
    body = `투수 ${pitcher || '?'} | 타자 ${batter || '?'}`;
  }

  const enabledStr = await AsyncStorage.getItem('lock_screen_notification_enabled');
  // Default to false if not set
  if (enabledStr !== 'true') return;

  // 동일한 identifier로 호출하면 새 알림이 뜨는게 아니라 기존 알림의 내용이 덮어써짐
  await Notifications.scheduleNotificationAsync({
    identifier: data.game_id,
    content: {
      title,
      body,
      autoDismiss: false,
    },
    trigger: null, // present immediately (replaces deprecated presentNotificationAsync)
  });
}
