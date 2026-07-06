#!/usr/bin/env node
/**
 * generate-image-data.js
 * Reads RentOasis-images.xlsx, merges with actual image files found in
 * /assets/images/, and writes /assets/js/image-data.json.
 *
 * Run:  node .github/scripts/generate-image-data.js
 * Deps: xlsx (npm install xlsx)
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

// header_row:1 means row 1 is the header; defval fills empty cells with ''
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

if (rows.length < 2) {
  console.error('❌  Spreadsheet has no data rows.');
  process.exit(1);
}

// ── 2. Normalise headers ────────────────────────────────────────────────────
// Trim, lowercase, replace spaces/special chars with underscores.
const rawHeaders = rows[0];
const headers    = rawHeaders.map(h =>
  String(h).trim().toLowerCase().replace(/[\s\-/\\]+/g, '_').replace(/[^a-z0-9_]/g, '')
);

console.log(`📋  Sheet: "${sheetName}"  |  Columns: ${headers.join(', ')}`);

// ── 3. Build a lookup: filename (no ext) → metadata object ─────────────────
const metaByBasename = new Map();

const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''));

for (const row of dataRows) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = String(row[i] ?? '').trim();
  });

  const filenameKey =
    ['filename', 'file_name', 'file', 'image', 'image_file', 'name']
      .find(k => headers.includes(k));

  if (!filenameKey) {
    console.warn('⚠️   No filename column found in spreadsheet. Merge will rely on row order only.');
    break;
  }

  const rawFile  = obj[filenameKey] || '';
  const basename = path.basename(rawFile, path.extname(rawFile)).toLowerCase();
  if (basename) metaByBasename.set(basename, obj);
}

// ── 4. Scan /assets/images/ for actual image files ─────────────────────────
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

// ── 5. Merge: for each image, attach spreadsheet metadata ──────────────────
const imageData = [];
const unmatched = [];

for (const absPath of allImagePaths) {
  const relPath  = '/' + path.relative(path.resolve('.'), absPath).replace(/\\/g, '/');
  const ext      = path.extname(absPath);
  const basename = path.basename(absPath, ext).toLowerCase();
  const filename = path.basename(absPath);

  const meta = metaByBasename.get(basename) || {};

  const record = {
    filename,
    path: relPath,
    ...meta,
    filename,
    path: relPath,
  };

  if (!metaByBasename.has(basename)) {
    unmatched.push(filename);
    record._unmatched = true;
  }

  imageData.push(record);
}

// ── 6. Sort: spreadsheet order first, unmatched alphabetically after ────────
const metaOrder = [...metaByBasename.keys()];
imageData.sort((a, b) => {
  const ai = metaOrder.indexOf(path.basename(a.filename, path.extname(a.filename)).toLowerCase());
  const bi = metaOrder.indexOf(path.basename(b.filename, path.extname(b.filename)).toLowerCase());
  if (ai === -1 && bi === -1) return a.filename.localeCompare(b.filename);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});

// ── 7. Write JSON ───────────────────────────────────────────────────────────
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(imageData, null, 2) + '\n', 'utf8');

// ── 8. Summary ──────────────────────────────────────────────────────────────
console.log(`\n✅  Wrote ${imageData.length} record(s) → ${OUTPUT_PATH}`);

if (unmatched.length) {
  console.warn(`\n⚠️   ${unmatched.length} image(s) had no spreadsheet row (flagged _unmatched: true):`);
  unmatched.forEach(f => console.warn(`     • ${f}`));
}

const diskBasenames = new Set(
  allImagePaths.map(p => path.basename(p, path.extname(p)).toLowerCase())
);
const orphanRows = [...metaByBasename.keys()].filter(k => !diskBasenames.has(k));
if (orphanRows.length) {
  console.warn(`\n⚠️   ${orphanRows.length} spreadsheet row(s) have no matching image on disk:`);
  orphanRows.forEach(k => console.warn(`     • ${k}`));
}
