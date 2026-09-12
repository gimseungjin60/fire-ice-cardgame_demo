#!/usr/bin/env node
/*
 * assets/ 폴더를 스캔해서 js/asset-manifest.js를 생성한다.
 * 이미지 파일을 추가/교체/삭제한 뒤에는 이 스크립트를 다시 실행하면 된다:
 *   node scripts/gen-asset-manifest.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUT_FILE = path.join(ROOT, 'js', 'asset-manifest.js');

const FOLDERS = ['enemies', 'props', 'heroes', 'cards', 'npc', 'bg'];
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg']);

function scanFolder(folder) {
  const dir = path.join(ASSETS_DIR, folder);
  const map = {};
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const key = path.basename(file, path.extname(file));
    map[key] = `assets/${folder}/${file}`;
  }
  return map;
}

const manifest = {};
for (const folder of FOLDERS) {
  manifest[folder] = scanFolder(folder);
}

const header =
  '// 자동 생성 파일 — 직접 수정하지 마세요.\n' +
  '// assets/ 폴더에 파일을 추가/교체/삭제한 뒤 다음 명령으로 다시 생성합니다:\n' +
  '//   node scripts/gen-asset-manifest.js\n';

const body = `window.ASSET_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, header + body, 'utf8');

let total = 0;
for (const folder of FOLDERS) {
  const count = Object.keys(manifest[folder]).length;
  total += count;
  console.log(`  ${folder.padEnd(8)} ${count}개`);
}
console.log(`asset-manifest.js 생성 완료 (총 ${total}개 파일) → js/asset-manifest.js`);
