import os

TEAMS = ["doosan", "hanwha", "kia", "kiwoom", "kt", "lg", "lotte", "nc", "samsung", "ssg"]
ALL_CHARACTERS = [
  "default", "determined", "sad", "joyful", "neutral", "angry", "furious", "shocked",
  "annoyed", "crying", "curious", "depressed", "flustered", "mocking", "sleepy", "tongue",
  "in_love", "extream_shock", "devastated", "hot_summer", "karen", "out", "praying",
  "rain_cancellation", "resigned_disgust", "thumbs_up", "provocative"
]

MOBILE_LIB_DIR = os.path.join(os.path.dirname(__file__), "..", "lib")

# 1. generate ballAssets.ts
with open(os.path.join(MOBILE_LIB_DIR, "ballAssets.ts"), "w") as f:
    f.write("export const LOCAL_BALLS: Record<string, number> = {\n")
    for team in TEAMS:
        f.write(f'  "{team}": require("../assets/team-ball/{team}.webp"),\n')
    f.write("};\n")

# 2. generate batAssets.ts
with open(os.path.join(MOBILE_LIB_DIR, "batAssets.ts"), "w") as f:
    f.write("export const LOCAL_BATS: Record<string, number> = {\n")
    for team in TEAMS:
        f.write(f'  "{team}": require("../assets/team-bat/{team}.webp"),\n')
    f.write('  "fallback": require("../assets/team-bat/bat.webp"),\n')
    f.write("};\n")

# 3. generate characterAssets.ts
with open(os.path.join(MOBILE_LIB_DIR, "characterAssets.ts"), "w") as f:
    f.write("export const ALL_EMOTIONS = new Set([\n")
    for char in ALL_CHARACTERS:
        f.write(f'  "{char}",\n')
    f.write("]);\n\n")
    
    f.write("export const LOCAL_CHARACTERS: Record<string, number> = {\n")
    for team in TEAMS:
        for char in ALL_CHARACTERS:
            f.write(f'  "{team}_{char}": require("../assets/team-characters/{team}_{char}.webp"),\n')
    f.write("};\n")

print("Asset mappings generated.")
