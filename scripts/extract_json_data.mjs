import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const lib = join(root, "mobile", "lib");
const dataDir = join(lib, "data");

mkdirSync(dataDir, { recursive: true });

function stripTrailingCommas(str) {
  // Remove trailing commas before closing braces/brackets
  return str.replace(/,(\s*[}\]])/g, "$1");
}

function extractJson(filePath, exportName) {
  let content = readFileSync(filePath, "utf8");
  const regex = new RegExp(`export const ${exportName}:?[^=]*=\\s*`);
  const match = content.match(regex);
  if (!match) {
    console.error(`Could not find export const ${exportName} in ${filePath}`);
    return null;
  }
  const start = match.index + match[0].length;
  // Find the matching closing };
  // Walk through brace by brace to handle nesting correctly
  let braceDepth = 0;
  let started = false;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") { braceDepth++; started = true; }
    else if (ch === "}") { braceDepth--; }
    if (started && braceDepth === 0 && content[i + 1] === ";") {
      end = i + 1;
      break;
    }
  }
  if (end === -1) {
    console.error(`Could not find closing }; for ${exportName}`);
    return null;
  }
  const jsonStr = stripTrailingCommas(content.slice(start, end));
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`JSON parse error for ${exportName}: ${e.message}`);
    console.error(`First 200 chars: ${jsonStr.slice(0, 200)}`);
    console.error(`Last 200 chars: ${jsonStr.slice(-200)}`);
    return null;
  }
}

// Process scores files
const scoreYears = [2021, 2022, 2023, 2024, 2025];
for (const year of scoreYears) {
  const tsPath = join(lib, `scores_${year}.ts`);
  const data = extractJson(tsPath, `SCORES_${year}`);
  if (data) {
    writeFileSync(join(dataDir, `scores_${year}.json`), JSON.stringify(data));
    console.log(`✅ scores_${year}.json (${Object.keys(data).length} dates, ${(Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0)}KB)`);
  }
}

// Process scheduleData — LOCAL_SCHEDULE
const schedData = extractJson(join(lib, "scheduleData.ts"), "LOCAL_SCHEDULE");
if (schedData) {
  writeFileSync(join(dataDir, "scheduleData.json"), JSON.stringify(schedData));
  console.log(`✅ scheduleData.json (${Object.keys(schedData).length} months, ${(Buffer.byteLength(JSON.stringify(schedData)) / 1024).toFixed(0)}KB)`);
}

// Process exhibitionData
const exhData = extractJson(join(lib, "exhibitionData.ts"), "EXHIBITION_SCORES");
if (exhData) {
  writeFileSync(join(dataDir, "exhibitionData.json"), JSON.stringify(exhData));
  console.log(`✅ exhibitionData.json (${Object.keys(exhData).length} dates, ${(Buffer.byteLength(JSON.stringify(exhData)) / 1024).toFixed(0)}KB)`);
}

console.log("\nDone extracting JSON data.");
