'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { scanRepo } = require(path.join(ROOT, 'lib', 'scanner'));
const { computeStats } = require(path.join(ROOT, 'lib', 'stats'));
const { renderCard } = require(path.join(ROOT, 'lib', 'render'));

const NOW = '2026-09-02T00:00:00Z';

function git(dir, args, env) {
  return execFileSync('git', ['-C', dir].concat(args), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {}),
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function buildRepo(dir) {
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.name', 'Test Human']);
  git(dir, ['config', 'user.email', 'human@example.com']);

  const files = {
    'src/app.ts': 0,
    'src/cli.ts': 0,
    'lib/util.py': 0,
    'README.md': 0
  };

  function commit(date, subject, body, changes) {
    for (const [file, lines] of Object.entries(changes)) {
      const full = path.join(dir, file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.appendFileSync(full, 'line\n'.repeat(lines));
      files[file] += lines;
    }
    git(dir, ['add', '.']);
    const env = { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
    git(dir, ['commit', '-m', subject, '-m', body || ''], env);
  }

  commit('2026-07-14T10:00:00+08:00', 'feat: initial scaffold', '', { 'src/app.ts': 40, 'src/cli.ts': 25 });
  commit('2026-07-15T11:00:00+08:00', 'feat: add util module', '', { 'lib/util.py': 30 });
  commit('2026-07-16T09:00:00+08:00', 'docs: readme', '', { 'README.md': 12 });

  commit('2026-08-20T10:00:00+08:00', 'feat: streaming parser',
    'Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    { 'src/app.ts': 4 });
  commit('2026-08-22T10:00:00+08:00', 'fix: edge case in tokenizer',
    'Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    { 'src/cli.ts': 7 });
  commit('2026-08-25T10:00:00+08:00', 'feat: python bindings',
    'Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    { 'lib/util.py': 2 });

  commit('2026-08-28T10:00:00+08:00', 'chore: refactor exports',
    'Co-Authored-By: Codex <noreply@openai.com>',
    { 'src/app.ts': 5 });
  commit('2026-09-01T10:00:00+08:00', 'feat: new command',
    'Co-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>',
    { 'src/cli.ts': 6 });

  return dir;
}

function testScan() {
  const dir = buildRepo(fs.mkdtempSync(path.join(os.tmpdir(), 'agentsume-test-')));
  const scan = scanRepo(dir);
  assert.strictEqual(scan.commits.length, 8, 'should find 8 commits');

  const claude = scan.commits.filter(c => c.agents.includes('claude-code'));
  const codex = scan.commits.filter(c => c.agents.includes('codex'));
  const copilot = scan.commits.filter(c => c.agents.includes('copilot'));
  const human = scan.commits.filter(c => c.agents.length === 0);

  assert.strictEqual(claude.length, 3);
  assert.strictEqual(codex.length, 1);
  assert.strictEqual(copilot.length, 1);
  assert.strictEqual(human.length, 3);

  assert.strictEqual(claude.reduce((s, c) => s + c.insertions, 0), 13, 'claude insertions');
  assert.ok(scan.commits.every(c => c.subject.length > 0));
  console.log('PASS scan: 8 commits, 3 human + 5 AI (claude 3, codex 1, copilot 1)');
  return dir;
}

function testStats(dir) {
  const scan = scanRepo(dir);
  const stats = computeStats(scan.commits, { weeks: 26, now: NOW, repoName: scan.repoName });

  assert.strictEqual(stats.totalCommits, 8);
  assert.strictEqual(stats.aiCommits, 5);
  assert.strictEqual(stats.aiShare, 63);
  assert.strictEqual(stats.aiLines, 13 + 5 + 6);
  assert.strictEqual(stats.agents.length, 3);

  const claude = stats.agents.find(a => a.id === 'claude-code');
  assert.strictEqual(claude.commits, 3);
  assert.strictEqual(claude.insertions, 13);
  assert.ok(['S', 'A', 'B', 'C'].includes(claude.grade));
  assert.ok(claude.share > 0 && claude.share < 1);

  assert.strictEqual(stats.weeks.length, 26);
  assert.strictEqual(stats.weeks.reduce((s, w) => s + w.ai, 0), 5);
  assert.strictEqual(stats.weeks.reduce((s, w) => s + w.human, 0), 3);

  const exts = stats.topExtensions.map(e => e.ext);
  assert.ok(exts.includes('ts'), 'ts in top extensions');
  assert.ok(exts.includes('py'), 'py in top extensions');
  console.log('PASS stats: aiShare=' + stats.aiShare + '%, grades=' + stats.agents.map(a => a.id + ':' + a.grade).join(','));
  return stats;
}

function testRender(stats) {
  const svg = renderCard(stats, { theme: 'dark' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('Claude Code'));
  assert.ok(svg.includes('Codex CLI'));
  assert.ok(svg.includes('GitHub Copilot'));
  assert.ok(svg.includes('AI AGENT RÉSUMÉ'));
  assert.ok(svg.includes('PERFORMANCE REVIEW'));

  const opens = (svg.match(/<text/g) || []).length;
  const closes = (svg.match(/<\/text>/g) || []).length;
  assert.strictEqual(opens, closes, 'text tags balanced');

  const rectOpens = (svg.match(/<rect/g) || []).length;
  assert.ok(rectOpens > 5, 'rects rendered');

  const light = renderCard(stats, { theme: 'light' });
  assert.ok(light.includes('#ffffff'), 'light theme bg');

  const empty = computeStats([], { weeks: 26, now: NOW, repoName: 'empty' });
  const emptySvg = renderCard(empty, {});
  assert.ok(emptySvg.includes('No AI agent activity detected'));
  console.log('PASS render: dark card ' + fmtBytes(svg.length) + ', light card ok, empty state ok');
  return svg;
}

function fmtBytes(n) {
  return (n / 1024).toFixed(1) + 'KB';
}

function testCLI(dir) {
  const stdout = execFileSync('node', [
    path.join(ROOT, 'agentsume.js'), dir, '--json'
  ], { encoding: 'utf8' });
  const j = JSON.parse(stdout);
  assert.strictEqual(j.totalCommits, 8);
  assert.strictEqual(j.aiCommits, 5);
  assert.ok(j.agents.every(a => a.name && a.grade));

  const out = path.join(os.tmpdir(), 'agentsume-cli-test.svg');
  execFileSync('node', [path.join(ROOT, 'agentsume.js'), dir, '-o', out], { encoding: 'utf8' });
  assert.ok(fs.existsSync(out));
  const content = fs.readFileSync(out, 'utf8');
  assert.ok(content.startsWith('<svg'));
  assert.ok(content.includes('AI AGENT RÉSUMÉ'));
  fs.unlinkSync(out);
  console.log('PASS cli: --json output parsed, svg written and validated');
}

function main() {
  const dir = testScan();
  const stats = testStats(dir);
  testRender(stats);
  testCLI(dir);
  console.log('\nall tests passed');
}

main();
