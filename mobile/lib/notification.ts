import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // 제목 구성: [7회초] LG 5 : 3 OB
  const inningStr = data.inning ? `${data.inning}회${data.is_top === 'true' ? '초' : '말'}` : '';
  const title = `[${inningStr}] ${data.away_team} ${data.away_score} : ${data.home_score} ${data.home_team}`;
  
  // 본문 구성: 🟢🟢🟡 (2B 1S 2O) | 1,3루 주자 있음
  const b = parseInt(data.ball || '0', 10);
  const s = parseInt(data.strike || '0', 10);
  const o = parseInt(data.out || '0', 10);

  const ballStr = '🟢'.repeat(b);
  const strikeStr = '🟡'.repeat(s);
  const outStr = '🔴'.repeat(o);
  
  const bso = `${ballStr}${strikeStr}${outStr}` || '카운트 없음';

  const bases = [];
  if (data.base1 === '1') bases.push('1');
  if (data.base2 === '1') bases.push('2');
  if (data.base3 === '1') bases.push('3');
  const baseStr = bases.length > 0 ? `${bases.join(',')}루 주자 있음` : '주자 없음';

  const body = `${bso} (${b}B ${s}S ${o}O) | ${baseStr}`;

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
