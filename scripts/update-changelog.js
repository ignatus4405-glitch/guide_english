#!/usr/bin/env node
/**
 * Обновляет docs/CHANGELOG.md на основе Conventional Commits.
 * Использование: node scripts/update-changelog.js <version> [fromTag]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const version = process.argv[2];
const fromTag = process.argv[3] || '';

if (!version) {
  console.error('Usage: node scripts/update-changelog.js <version> [fromTag]');
  process.exit(1);
}

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return ''; }
}

const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
const raw = sh(`git log ${range} --pretty=format:%H%x1f%s%x1f%b%x1e`).replace(/\r\n/g, '\n');
const commits = raw ? raw.split('\x1e').map(s => s.trim()).filter(Boolean)
  .map(rec => {
  const [hash, subject, body = ''] = rec.split('\x1f');
  const m = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject || '');
  return {
    hash: (hash || '').slice(0, 7),
    type: m ? m[1].toLowerCase() : 'other',
    scope: m && m[2] ? m[2].replace(/[()]/g, '') : '',
    breaking: !!(m && m[3]) || /BREAKING[ -]CHANGE/i.test(body || ''),
    description: m ? m[4] : (subject || ''),
    raw: subject || ''
  };
})
  // merge-коммиты и служебные коммиты релиза не попадают в changelog
  .filter(c => !/^Merge\s/i.test(c.raw) && !/^chore\(release\)/i.test(c.raw))
  : [];

const GROUPS = [
  { key: 'feat', title: '✨ Новые возможности' },
  { key: 'fix', title: '🐛 Исправления' },
  { key: 'perf', title: '⚡ Производительность' },
  { key: 'refactor', title: '♻️ Рефакторинг' },
  { key: 'docs', title: '📝 Документация' },
  { key: 'test', title: '✅ Тесты' },
  { key: 'build', title: '📦 Сборка' },
  { key: 'ci', title: '🤖 CI/CD' },
  { key: 'style', title: '💅 Стиль' },
  { key: 'chore', title: '🔧 Обслуживание' },
  { key: 'other', title: 'Прочее' }
];

const breaking = commits.filter(c => c.breaking);
const date = new Date().toISOString().slice(0, 10);
const repo = 'https://github.com/ignatus4405-glitch/guide_english';

let entry = `## [${version}] — ${date}\n\n`;
entry += `[Все изменения](${repo}/compare/${fromTag || 'main'}...v${version})\n\n`;

if (breaking.length) {
  entry += `### ⚠️ Breaking changes\n\n`;
  breaking.forEach(c => { entry += `- ${c.description} (${c.hash})\n`; });
  entry += '\n';
}

let hasGroups = false;
for (const g of GROUPS) {
  const list = commits.filter(c => c.type === g.key && !c.breaking);
  if (!list.length) continue;
  hasGroups = true;
  entry += `### ${g.title}\n\n`;
  list.forEach(c => {
    const scope = c.scope ? `**${c.scope}:** ` : '';
    entry += `- ${scope}${c.description} (${c.hash})\n`;
  });
  entry += '\n';
}

if (!hasGroups && !breaking.length) {
  entry += `- Плановое обновление сборки и документации.\n\n`;
}

const FILE = path.join(ROOT, 'docs', 'CHANGELOG.md');
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, '# История изменений\n\nВсе заметные изменения проекта. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).\n\n');
}

let content = fs.readFileSync(FILE, 'utf8');

// Ручные заметки из «Unreleased» переносим в запись этого релиза и очищаем раздел,
// чтобы подробное описание не потерялось и не осталось висеть в changelog навсегда.
const uStart = content.search(/^## Unreleased\s*$/m);
if (uStart >= 0) {
  const afterStart = content.indexOf('\n', uStart) + 1;
  const rest = content.slice(afterStart);
  const nextHeading = rest.search(/^## /m);
  const bodyEnd = nextHeading >= 0 ? afterStart + nextHeading : content.length;
  const body = content.slice(afterStart, bodyEnd).trim();
  content = content.slice(0, uStart) + '## Unreleased\n\n' + content.slice(bodyEnd);
  if (body) {
    entry += `\n### Подробности\n\n${body.replace(/^### /gm, '#### ')}\n\n`;
  }
}

const marker = '<!-- RELEASES:START -->';
if (content.includes(marker)) {
  content = content.replace(marker, `${marker}\n\n${entry.trim()}\n`);
} else {
  // insert after intro (first blank line block)
  const idx = content.indexOf('\n\n', content.indexOf('# История изменений'));
  const cut = idx > 0 ? content.indexOf('\n\n', idx + 2) : -1;
  if (cut > 0) content = content.slice(0, cut + 2) + `<!-- RELEASES:START -->\n\n${entry.trim()}\n\n` + content.slice(cut + 2);
  else content += `\n<!-- RELEASES:START -->\n\n${entry.trim()}\n`;
}

fs.writeFileSync(FILE, content);
console.log(`✓ docs/CHANGELOG.md обновлён: ${version} (${commits.length} коммитов)`);
