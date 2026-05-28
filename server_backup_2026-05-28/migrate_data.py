import json
import os
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from init_db import Team, Game, Standing, Stadium, CheeringSong

DATABASE_URL = 'postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db'
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

DATA_DIR = os.path.expanduser('~/fullcount_backend/repo/data')

def migrate_teams():
    # teams/index.json 또는 today-games.json에서 팀 정보 추출
    # 여기서는 간단히 10개 구단 수동 등록 (또는 JSON 분석)
    teams_data = [
        {'id': 'doosan', 'name': '두산', 'full_name': '두산 베어스'},
        {'id': 'lg', 'name': 'LG', 'full_name': 'LG 트윈스'},
        {'id': 'kiwoom', 'name': '키움', 'full_name': '키움 히어로즈'},
        {'id': 'ssg', 'name': 'SSG', 'full_name': 'SSG 랜더스'},
        {'id': 'hanwha', 'name': '한화', 'full_name': '한화 이글스'},
        {'id': 'kt', 'name': 'KT', 'full_name': 'KT 위즈'},
        {'id': 'kia', 'name': 'KIA', 'full_name': 'KIA 타이거즈'},
        {'id': 'lotte', 'name': '롯데', 'full_name': '롯데 자이언츠'},
        {'id': 'samsung', 'name': '삼성', 'full_name': '삼성 라이온즈'},
        {'id': 'nc', 'name': 'NC', 'full_name': 'NC 다이노스'}
    ]
    for t in teams_data:
        team = Team(**t)
        session.merge(team)
    session.commit()
    print('Teams migrated.')

def migrate_games():
    with open(os.path.join(DATA_DIR, 'today-games.json'), 'r') as f:
        data = json.load(f)
        for g in data.get('games', []):
            game = Game(
                id=g['id'],
                date=datetime.strptime(g['date'], '%Y-%m-%d').date(),
                time=datetime.strptime(g['time'], '%H:%M').time() if g['time'] else None,
                venue=g['venue'],
                home_team_id=g['home']['id'],
                away_team_id=g['away']['id'],
                status=g['status'],
                home_score=g['home'].get('score'),
                away_score=g['away'].get('score')
            )
            session.merge(game)
    session.commit()
    print('Games migrated.')

def migrate_standings():
    with open(os.path.join(DATA_DIR, 'kbo_standings.json'), 'r') as f:
        data = json.load(f)
        date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        for s in data.get('standings', []):
            standing = Standing(
                date=datetime.strptime(date_str, '%Y-%m-%d').date(),
                team_id=s['id'],
                rank=s['rank'],
                wins=s['wins'],
                draws=s['draws'],
                losses=s['losses'],
                win_rate=s['winRate'],
                game_behind=s['gameBehind'],
                streak=s['streak']
            )
            session.add(standing)
    session.commit()
    print('Standings migrated.')

if __name__ == '__main__':
    migrate_teams()
    migrate_games()
    migrate_standings()
    print('Migration completed successfully.')
