import urllib.request, urllib.parse, json, ssl
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
KBO_URL = 'https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList'
DATA_DIR = '/home/opc/fullcount_backend/repo/data'

KBO_TEAM_MAP = {
    'OB': 'doosan', 'LG': 'lg', 'WO': 'kiwoom', 'SK': 'ssg',
    'KT': 'kt', 'HT': 'kia', 'HH': 'hanwha', 'SS': 'samsung',
    'LT': 'lotte', 'NC': 'nc',
}


def fetch_games(date_str):
    data = urllib.parse.urlencode({'leId': 1, 'srId': 1, 'date': date_str}).encode()
    req = urllib.request.Request(KBO_URL, data=data, headers={
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': UA,
        'Referer': 'https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx',
    })
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
        return json.loads(resp.read().decode('utf-8', errors='replace'))


def main():
    all_games = []
    start = datetime(2026, 3, 7)
    end = datetime(2026, 3, 27)
    d = start
    while d <= end:
        ds = d.strftime('%Y%m%d')
        try:
            data = fetch_games(ds)
            games = data.get('game', [])
            if games:
                for g in games:
                    away_id = g.get('AWAY_ID', '')
                    home_id = g.get('HOME_ID', '')
                    t_score = g.get('T_SCORE_CN', '0')
                    b_score = g.get('B_SCORE_CN', '0')
                    all_games.append({
                        'date': g['G_DT'],
                        'time': g.get('G_TM', '13:00'),
                        'venue': g.get('S_NM', ''),
                        'away': g.get('AWAY_NM', ''),
                        'home': g.get('HOME_NM', ''),
                        'awayTeamId': KBO_TEAM_MAP.get(away_id, ''),
                        'homeTeamId': KBO_TEAM_MAP.get(home_id, ''),
                        'awayScore': int(b_score) if b_score and b_score.isdigit() else None,
                        'homeScore': int(t_score) if t_score and t_score.isdigit() else None,
                        'gameId': g['G_ID'],
                        'awayStarter': g.get('B_PIT_P_NM', '').strip() or None,
                        'homeStarter': g.get('T_PIT_P_NM', '').strip() or None,
                        'winPitcher': g.get('W_PIT_P_NM', '').strip() or None,
                        'losePitcher': g.get('L_PIT_P_NM', '').strip() or None,
                        'savePitcher': g.get('SV_PIT_P_NM', '').strip() or None,
                        'cancelled': g.get('CANCEL_SC_NM', '') != '정상경기',
                    })
            print(f'{ds}: {len(games)} games')
        except Exception as e:
            print(f'{ds}: {e}')
        d += timedelta(days=1)

    all_games.sort(key=lambda x: (x['date'], x['gameId']))

    output = {
        'year': 2026,
        'generatedAt': datetime.now(KST).isoformat(),
        'source': 'KBO API (koreabaseball.com/ws/Main.asmx/GetKboGameList, srId=1)',
        'games': all_games,
    }

    out_path = f'{DATA_DIR}/exhibition-games-2026.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'\nWritten {len(all_games)} exhibition games to {out_path}')


if __name__ == '__main__':
    main()
