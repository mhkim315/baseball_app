"""One-time migration: parse cheering.html into data/cheering-songs.json."""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "cheering.html"
OUT_PATH = ROOT / "data" / "cheering-songs.json"


class CheeringParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.data = {"teams": {}}
        self._current_team = None
        self._current_section = None
        self._current_song = None
        self._in_song_name = False
        self._in_section_title = False
        self._in_yt_btn = False
        self._yt_href = ""
        self._song_name = ""
        self._section_title = ""

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        if tag == "section" and "data-team-section" in attrs_d:
            self._current_team = attrs_d["data-team-section"]
            self.data["teams"][self._current_team] = {"sections": []}
        if tag == "article" and "cheering-flow" in attrs_d.get("class", ""):
            self._current_section = {"title": "", "songs": []}
        if tag == "h4" and "cheering-flow-title" in attrs_d.get("class", ""):
            self._in_section_title = True
            self._section_title = ""
        if tag == "span" and "cheering-song-name" in attrs_d.get("class", ""):
            self._in_song_name = True
            self._song_name = ""
        if tag == "a" and "cheering-yt-btn" in attrs_d.get("class", ""):
            self._in_yt_btn = True
            self._yt_href = attrs_d.get("href", "")
        if tag == "li" and "cheering-song-item" in attrs_d.get("class", ""):
            self._current_song = {"name": "", "youtubeUrl": ""}

    def handle_endtag(self, tag):
        if tag == "h4" and self._in_section_title:
            self._in_section_title = False
            if self._current_section is not None:
                self._current_section["title"] = self._section_title.strip()
        if tag == "span" and self._in_song_name:
            self._in_song_name = False
            if self._current_song is not None:
                self._current_song["name"] = self._song_name.strip()
        if tag == "a" and self._in_yt_btn:
            self._in_yt_btn = False
            if self._current_song is not None:
                self._current_song["youtubeUrl"] = self._yt_href
        if tag == "li" and self._current_song is not None:
            if self._current_section is not None:
                if self._current_song["name"] or self._current_song["youtubeUrl"]:
                    self._current_section["songs"].append(self._current_song)
            self._current_song = None
        if tag == "article" and self._current_section is not None:
            if self._current_team and (self._current_section["title"] or self._current_section["songs"]):
                self.data["teams"][self._current_team]["sections"].append(self._current_section)
            self._current_section = None

    def handle_data(self, data):
        if self._in_song_name:
            self._song_name += data
        elif self._in_section_title:
            self._section_title += data


def main():
    html = HTML_PATH.read_text(encoding="utf-8")
    # Collapse repeated SVG markup
    html = re.sub(r'<svg[^>]*class="cheering-yt-svg"[^>]*>.*?</svg>', "", html, flags=re.DOTALL)
    parser = CheeringParser()
    parser.feed(html)

    # Remove empty teams and sections
    for team_id in list(parser.data["teams"]):
        sections = parser.data["teams"][team_id]["sections"]
        sections[:] = [s for s in sections if s["title"] and s["songs"]]
        if not sections:
            del parser.data["teams"][team_id]

    # Add metadata
    parser.data["_meta"] = {"source": "cheering.html", "description": "팀별 응원가/응원곡 데이터"}
    OUT_PATH.write_text(json.dumps(parser.data, ensure_ascii=False, indent=2), encoding="utf-8")
    team_count = len(parser.data["teams"])
    song_count = sum(len(t["sections"]) for t in parser.data["teams"].values())
    print(f"Migrated {team_count} teams, {song_count} sections -> {OUT_PATH}")


if __name__ == "__main__":
    main()
