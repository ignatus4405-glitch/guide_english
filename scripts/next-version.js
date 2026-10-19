#!/usr/bin/env node
/**
 * Вычисляет следующую версию по Conventional Commits с момента последнего тега vX.Y.Z.
 *
 * Правила:
 *   BREAKING CHANGE / "type!:"  → major
 *   feat                        → minor
 *   fix, perf, refactor, revert → patch
 *   docs, chore, ci, test, style, build → без релиза (если есть только они)
 *
 * Использование:
 *   node scripts/next-version.js                 # печать JSON
 *   node scripts/next-version.js --github        # запись в $GITHUB_OUTPUT
 *   node scripts/next-version.js --force patch   # принудительный тип
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

function lastTag() {
  return sh('git describe --tags --abbrev=0 --match "v*"');
}

function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const raw = sh(`git log ${range} --pretty=format:%H%x1f%s%x1f%b%x1e`);
  if (!raw) return [];
  return raw.split('\x1e').map(s => s.trim()).filter(Boolean).map(rec => {
    const [hash, subject, body = ''] = rec.split('\x1f');
    return { hash, subject, body };
  });
}

function parseCommit(c) {
  const m = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(c.subject || '');
  const type = m ? m[1].toLowerCase() : 'other';
  const breaking = !!(m && m[3]) || /BREAKING[ -]CHANGE/i.test(c.body || '');
  return { ...c, type, breaking, description: m ? m[4] : c.subject };
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const args = process.argv.slice(2);
  const forceIdx = args.indexOf('--force');
  let forced = forceIdx >= 0 ? args[forceIdx + 1] : null;
  if (forced === 'auto' || forced === 'none') forced = null;
  if (!['patch', 'minor', 'major'].includes(forced)) forced = null;

  const tag = lastTag();
  const commits = commitsSince(tag).map(parseCommit);

  const hasBreaking = commits.some(c => c.breaking);
  const hasFeature = commits.some(c => c.type === 'feat');
  const hasFix = commits.some(c => ['fix', 'perf', 'refactor', 'revert'].includes(c.type));

  let bump = 'none';
  if (forced) bump = forced;
  else if (hasBreaking) bump = 'major';
  else if (hasFeature) bump = 'minor';
  else if (hasFix) bump = 'patch';

  // Первый релиз: тегов нет, берём версию из package.json
  let version;
  let changed;
  if (!tag) {
    // Первый релиз: отталкиваемся от версии в package.json
    version = forced ? bumpVersion(pkg.version, forced) : pkg.version;
    changed = true;
    bump = forced || 'initial';
  } else {
    changed = bump !== 'none';
    version = changed ? bumpVersion(pkg.version, bump) : pkg.version;
  }

  const result = {
    version,
    previousVersion: pkg.version,
    bump,
    changed,
    tag: tag || '',
    commits: commits.length,
    features: commits.filter(c => c.type === 'feat').length,
    fixes: commits.filter(c => c.type === 'fix').length
  };

  console.log(JSON.stringify(result, null, 2));

  if (args.includes('--github') && process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(result).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, lines + '\n');
  }
}

main();
