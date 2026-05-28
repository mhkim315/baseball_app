import os
from sqlalchemy import create_engine, Column, Integer, String, Date, Time, ForeignKey, DECIMAL, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = 'postgresql://fullcount_user:fullcount_pass_2026@localhost/fullcount_db'
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Team(Base):
    __tablename__ = 'teams'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    full_name = Column(String)

class Game(Base):
    __tablename__ = 'games'
    id = Column(String, primary_key=True)
    date = Column(Date, nullable=False)
    time = Column(Time)
    venue = Column(String)
    home_team_id = Column(String, ForeignKey('teams.id'))
    away_team_id = Column(String, ForeignKey('teams.id'))
    status = Column(String)
    home_score = Column(Integer)
    away_score = Column(Integer)

class Standing(Base):
    __tablename__ = 'standings'
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    team_id = Column(String, ForeignKey('teams.id'))
    rank = Column(Integer)
    wins = Column(Integer)
    draws = Column(Integer)
    losses = Column(Integer)
    win_rate = Column(DECIMAL(5,3))
    game_behind = Column(DECIMAL(5,1))
    streak = Column(String)

class Stadium(Base):
    __tablename__ = 'stadiums'
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    home_team_id = Column(String, ForeignKey('teams.id'))

class CheeringSong(Base):
    __tablename__ = 'cheering_songs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(String, ForeignKey('teams.id'))
    title = Column(String, nullable=False)
    type = Column(String)
    youtube_url = Column(String)
    lyrics = Column(Text)

if __name__ == '__main__':
    Base.metadata.create_all(engine)
    print('Database tables created successfully.')
