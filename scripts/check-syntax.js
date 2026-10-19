#!/usr/bin/env node
/**
 * Проверяет синтаксис всех JS-файлов проекта через `node --check`.
 * Используется в CI и локально: npm run lint
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['src', 'scripts', 'tests'];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full);
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
}

DIRS.forEach(d => {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full);
});

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error(`✗ ${path.relative(ROOT, file)}`);
    console.error(String(e.stderr || e.message));
  }
}

if (failed) {
  console.error(`\n${failed} файл(ов) с синтаксическими ошибками`);
  process.exit(1);
}

console.log(`✓ Синтаксис ${files.length} JS-файлов корректен`);
