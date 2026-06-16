with open("/home/opc/fullcount_backend/scripts/naver_api.py") as f:
    lines = f.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if line.startswith("def parse_score_inning"):
        start = i
    elif start is not None and line.startswith("def ") and i > start:
        end = i
        break
if end is None:
    end = len(lines)
if start is None:
    print("ERROR: function not found")
    exit(1)

new_lines = [
    "def parse_score_inning(inn_input):\n",
    '    """Parse Naver inning scores. Accepts comma-separated string or list.\n',
    '    "0,0,1,0,4" or [0,0,1,0,4] -> [0, 0, 1, 0, 4].\n',
    "    Non-numeric values (hyphens etc) are treated as 0.\"\"\"\n",
    "    if isinstance(inn_input, list):\n",
    "        result = []\n",
    "        for x in inn_input:\n",
    "            try:\n",
    "                result.append(int(x))\n",
    "            except (ValueError, TypeError):\n",
    "                result.append(0)\n",
    "        return result\n",
    '    if not inn_input or not str(inn_input).strip():\n',
    "        return []\n",
    "    result = []\n",
    '    for x in str(inn_input).split(","):\n',
    "        x = x.strip()\n",
    '        if x == "":\n',
    "            continue\n",
    "        try:\n",
    "            result.append(int(x))\n",
    "        except ValueError:\n",
    "            result.append(0)\n",
    "    return result\n",
]

new_content = lines[:start] + new_lines + lines[end:]
with open("/home/opc/fullcount_backend/scripts/naver_api.py", "w") as f:
    f.writelines(new_content)
print("Done - parse_score_inning replaced")
