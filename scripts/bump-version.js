#!/usr/bin/env node
/**
 * Ручное повышение версии (для локальной работы/аварийного релиза).
 * Автоматический релиз делает .github/workflows/release.yml по Conventional Commits.
 *
 * Использование: node scripts/bump-version.js patch|minor|major
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const type = process.argv[2];

if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Usage: node scripts/bump-version.js patch|minor|major');
  process.exit(1);
}

const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const previous = pkg.version;
const [major, minor, patch] = previous.split('.').map(Number);

let next;
if (type === 'major') next = `${major + 1}.0.0`;
else if (type === 'minor') next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// синхронизируем package-lock.json, если он есть
const lockPath = path.join(ROOT, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = next;
  if (lock.packages && lock.packages['']) lock.packages[''].version = next;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  console.log('✓ package-lock.json');
}

console.log(`✓ package.json: ${previous} → ${next} (${type})`);
console.log('\nДальше:');
console.log('  git add package.json package-lock.json');
console.log(`  git commit -m "chore(release): v${next}"`);
console.log(`  git tag v${next}`);
console.log('  git push --follow-tags');
