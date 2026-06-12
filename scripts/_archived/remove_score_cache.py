"""Remove date-based cache from score-summary endpoint.
daily-scores.json is a local file (updated every 3-5 min), no caching needed."""

path = "/home/opc/fullcount_backend/main.py"

with open(path, "r") as f:
    content = f.read()

# Replace the caching block for 2026+ path
old = """    today = date.today()
    if _DAILY_SCORES_CACHE["data"] is None or _DAILY_SCORES_CACHE["cached_date"] != today:
        data = load_json("daily-scores.json")
        if data is None:
            return JSONResponse({"error": "Data not found"}, status_code=404)
        _DAILY_SCORES_CACHE["data"] = data
        _DAILY_SCORES_CACHE["cached_date"] = today

    dates = _DAILY_SCORES_CACHE["data"].get("dates", {})"""

new = """    data = load_json("daily-scores.json")
    if data is None:
        return JSONResponse({"error": "Data not found"}, status_code=404)

    dates = data.get("dates", {})"""

if old not in content:
    print("ERROR: Could not find cache block to replace")
    # Debug: show what's around the target area
    import re
    m = re.search(r"date\.today\(\)", content)
    if m:
        start = max(0, m.start() - 50)
        end = min(len(content), m.end() + 300)
        print(f"Found 'date.today()' at position {m.start()}:")
        print(content[start:end])
    exit(1)

content = content.replace(old, new)

# Also remove the now-unused _DAILY_SCORES_CACHE dict
old_cache = '\n_DAILY_SCORES_CACHE = {"data": None, "cached_date": None}'
if old_cache in content:
    content = content.replace(old_cache, "")
    print("Removed _DAILY_SCORES_CACHE dict")
else:
    print("WARNING: _DAILY_SCORES_CACHE dict not found (may already be removed)")

# Verify syntax
compile(content, path, "exec")

with open(path, "w") as f:
    f.write(content)

print("Done. Cache removed from score-summary endpoint.")
