#!/usr/bin/env node
/**
 * generate-image-data.js
 * Reads RentOasis-images.xlsx, merges with actual image files in
 * /assets/images/, and writes /assets/js/image-data.json.
 *
 * Preserves original spreadsheet header casing (Filename, Alt Text,
 * Include, etc.) so hero-loader.js field references work without changes.
 *
 * Run:  node .github/scripts/generate-image-data.js
 * Deps: xlsx  (installed automatically by the GitHub Action)
 */

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ── Paths (relative to repo root) ──────────────────────────────────────────
const XLSX_PATH   = path.resolve('assets/js/RentOasis-images.xlsx');
const IMAGES_DIR  = path.resolve('assets/images');
const OUTPUT_PATH = path.resolve('assets/js/image-data.json');

// ── Supported image extensions ──────────────────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg']);

// ── 1. Read the workbook ────────────────────────────────────────────────────
if (!fs.existsSync(XLSX_PATH)) {
  console.error(`❌  XLSX not found: ${XLSX_PATH}`);
  process.exit(1);
}

const workbook  = XLSX.readFile(XLSX_PATH);
const sheetName = workbook.SheetNames[0];
const sheet     = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

if (rows.length < 2) {
  console.error('❌  Spreadsheet has no data rows.');
  process.exit(1);
}

// ── 2. Keep headers exactly as typed in the spreadsheet ────────────────────
// hero-loader.js uses: img.Filename, img["Alt Text"], img.Include
// Do NOT normalize to lowercase — preserve the original casing.
const headers = rows[0].map(h => String(h).trim());
console.log(`📋  Sheet: "${sheetName}"  |  Columns: ${headers.join(', ')}`);

// ── 3. Find which column index holds the filename ──────────────────────────
const filenameColIndex = headers.findIndex(h =>
  ['Filename', 'filename', 'File', 'file', 'Image', 'image', 'Name', 'name'].includes(h)
);

if (filenameColIndex === -1) {
  console.error('❌  No filename column found. Expected a column named "Filename" (or similar).');
  process.exit(1);
}

const filenameHeader = headers[filenameColIndex];

// ── 4. Build lookup: basename (no ext, lowercase) → spreadsheet row object ─
const metaByBasename = new Map();
const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));

for (const row of dataRows) {
  const obj = {};
  headers.forEach((h, i) => {
    const raw = row[i];

    // Convert the Include column to a proper boolean
    if (h === 'Include') {
      if (typeof raw === 'boolean') {
        obj[h] = raw;
      } else {
        const str = String(raw).trim().toLowerCase();
        obj[h] = str === 'true' || str === '1' || str === 'yes';
      }
    } else {
      obj[h] = String(raw ?? '').trim();
    }
  });

  const rawFile  = obj[filenameHeader] || '';
  const basename = path.basename(rawFile, path.extname(rawFile)).toLowerCase();
  if (basename) metaByBasename.set(basename, obj);
}

// ── 5. Scan /assets/images/ for actual image files ─────────────────────────
if (!fs.existsSync(IMAGES_DIR)) {
  console.error(`❌  Images directory not found: ${IMAGES_DIR}`);
  process.exit(1);
}

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

const allImagePaths = walkDir(IMAGES_DIR);
console.log(`🖼️   Found ${allImagePaths.length} image file(s) in ${IMAGES_DIR}`);

// ── 6. Merge: image files + spreadsheet metadata ───────────────────────────
const imageData = [];
const unmatched = [];

for (const absPath of allImagePaths) {
  const ext      = path.extname(absPath);
  const basename = path.basename(absPath, ext).toLowerCase();
  const filename = path.basename(absPath);
  const meta     = metaByBasename.get(basename);

  if (meta) {
    // Spreadsheet row found — use it directly, but guarantee Filename
    // reflects the actual disk filename (in case casing differs).
    imageData.push({ ...meta, [filenameHeader]: filename });
  } else {
    // No spreadsheet row — include the image but flag it.
    unmatched.push(filename);
    imageData.push({
      [filenameHeader]: filename,
      'Alt Text':       filename,
      'Description':    '',
      'Tags':           '',
      'Include':        false,   // excluded from hero until added to spreadsheet
      _unmatched:       true,
    });
  }
}

// ── 7. Sort: spreadsheet insertion order first, unmatched alpha after ───────
const metaOrder = [...metaByBasename.keys()];
imageData.sort((a, b) => {
  const aKey = path.basename(a[filenameHeader], path.extname(a[filenameHeader])).toLowerCase();
  const bKey = path.basename(b[filenameHeader], path.extname(b[filenameHeader])).toLowerCase();
  const ai   = metaOrder.indexOf(aKey);
  const bi   = metaOrder.indexOf(bKey);
  if (ai === -1 && bi === -1) return aKey.localeCompare(bKey);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});

// ── 8. Write JSON ───────────────────────────────────────────────────────────
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(imageData, null, 2) + '\n', 'utf8');

// ── 9. Summary ──────────────────────────────────────────────────────────────
console.log(`\n✅  Wrote ${imageData.length} record(s) → ${OUTPUT_PATH}`);

if (unmatched.length) {
  console.warn(`\n⚠️   ${unmatched.length} image(s) had no spreadsheet row (Include set to false):`);
  unmatched.forEach(f => console.warn(`     • ${f}`));
}

const diskBasenames = new Set(
  allImagePaths.map(p => path.basename(p, path.extname(p)).toLowerCase())
);
const orphanRows = [...metaByBasename.keys()].filter(k => !diskBasenames.has(k));
if (orphanRows.length) {
  console.warn(`\n⚠️   ${orphanRows.length} spreadsheet row(s) have no matching image file on disk:`);
  orphanRows.forEach(k => console.warn(`     • ${k}`));
}
