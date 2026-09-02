#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { scanRepo } = require('./lib/scanner');
const { computeStats } = require('./lib/stats');
const { renderCard } = require('./lib/render');

const HELP = [
  'agentsume - a resume and performance review for your AI coding agents',
  '',
  'Usage:',
  '  agentsume [repo] [options]',
  '',
  'Options:',
  '  -o, --out <file>     output SVG path (default: agentsume.svg)',
  '  -w, --weeks <n>      weeks shown in the activity timeline (default: 26)',
  '  -t, --theme <name>   card theme: dark | light (default: dark)',
  '      --since <date>   only scan commits since this git date',
  '      --json           print stats as JSON instead of writing a card',
  '  -h, --help           show this help',
  '',
  'Examples:',
  '  agentsume                          scan current repo',
  '  agentsume /path/to/repo -o card.svg',
  '  agentsume --json                   machine-readable stats',
  ''
].join('\n');

function parseArgs(argv) {
  const opts = { repo: '.', out: 'agentsume.svg', weeks: 26, json: false, theme: 'dark', since: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') opts.out = argv[++i];
    else if (a === '--weeks' || a === '-w') opts.weeks = parseInt(argv[++i], 10) || 26;
    else if (a === '--theme' || a === '-t') opts.theme = argv[++i];
    else if (a === '--since') opts.since = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('-')) throw new Error('unknown option: ' + a);
    else positional.push(a);
  }
  if (positional[0]) opts.repo = positional[0];
  return opts;
}

function actionInputs() {
  const inp = {};
  if (process.env.INPUT_WEEKS) {
    const w = parseInt(process.env.INPUT_WEEKS, 10);
    if (w > 0) inp.weeks = w;
  }
  if (process.env.INPUT_OUTPUT) inp.out = process.env.INPUT_OUTPUT;
  if (process.env.INPUT_THEME) inp.theme = process.env.INPUT_THEME;
  return inp;
}

function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function printSummary(stats, outFile) {
  const line = '-'.repeat(62);
  console.log('');
  console.log('  agentsume - AI Agent Resume');
  console.log('  ' + line);
  console.log('  repo ' + stats.repo + ': ' + fmt(stats.totalCommits) + ' commits scanned, ' + fmt(stats.aiCommits) + ' AI-assisted (' + stats.aiShare + '%)');
  console.log('');
  for (const a of stats.agents) {
    const name = a.name.padEnd(18);
    const bar = '#'.repeat(Math.max(1, Math.round(a.share * 24)));
    console.log('  ' + name + bar.padEnd(26) + String(a.commits).padStart(4) + ' commits  +' + fmt(a.insertions) + ' -' + fmt(a.deletions) + '  [' + a.grade + ']');
  }
  console.log('');
  console.log('  card written to ' + outFile);
  console.log('');
}

function commitAndPush(repo, outFile) {
  const git = args => execFileSync('git', ['-C', repo].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git(['add', outFile]);
    try {
      git(['diff', '--cached', '--quiet']);
      console.log('card unchanged, nothing to commit');
      return;
    } catch (e) {
      // diff exists -> commit
    }
    git(['commit', '-m', 'chore: update agentsume card [skip ci]']);
    git(['push']);
    console.log('card committed and pushed');
  } catch (err) {
    console.error('failed to commit card: ' + (err.stderr ? String(err.stderr).trim() : err.message));
    process.exitCode = 1;
  }
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error('error: ' + err.message);
    console.error(HELP);
    return 1;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const isAction = process.env.GITHUB_ACTIONS === 'true';
  if (isAction) {
    Object.assign(opts, actionInputs());
    if (process.env.GITHUB_WORKSPACE && opts.repo === '.') opts.repo = process.env.GITHUB_WORKSPACE;
  }

  const repo = path.resolve(opts.repo);
  if (!fs.existsSync(path.join(repo, '.git'))) {
    console.error('error: ' + repo + ' is not a git repository');
    return 1;
  }

  const scan = scanRepo(repo, { since: opts.since });
  if (scan.commits.length === 0) {
    console.error('error: no commits found in ' + repo);
    return 1;
  }

  const stats = computeStats(scan.commits, { weeks: opts.weeks, repoName: scan.repoName });

  if (opts.json) {
    console.log(JSON.stringify(stats, null, 2));
    return 0;
  }

  const svg = renderCard(stats, { theme: opts.theme });
  fs.writeFileSync(opts.out, svg);
  printSummary(stats, opts.out);

  if (isAction && String(process.env.INPUT_COMMIT || '').toLowerCase() === 'true') {
    commitAndPush(repo, opts.out);
  }
  return 0;
}

process.exit(main());
