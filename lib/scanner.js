'use strict';

const path = require('path');
const { execFileSync } = require('child_process');
const { detectAgents } = require('./detect');

const FIELD = '\u001f';
const RECORD = '\u001e';

function runGit(repo, args) {
  return execFileSync('git', ['-C', repo].concat(args), {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
}

function parseNumstatLine(line) {
  const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
  if (!m) return null;
  return { ins: m[1] === '-' ? 0 : +m[1], del: m[2] === '-' ? 0 : +m[2], file: m[3] };
}

function scanRepo(repo, opts) {
  opts = opts || {};
  const fmt = RECORD + ['%H', '%an', '%ae', '%aI', '%s', '%b'].join(FIELD);
  const args = ['log', '--numstat', '--no-merges', '--format=' + fmt];
  if (opts.since) args.push('--since=' + opts.since);

  let raw;
  let repoName = path.basename(path.resolve(repo));
  try {
    raw = runGit(repo, args);
    const toplevel = runGit(repo, ['rev-parse', '--show-toplevel']).trim();
    if (toplevel) repoName = path.basename(toplevel.replace(/[\\/]+$/, ''));
  } catch (err) {
    throw new Error('git log failed: ' + (err.stderr ? String(err.stderr).trim() : err.message));
  }

  const commits = [];
  for (const chunk of raw.split(RECORD)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

    const paths = [];
    let i = lines.length - 1;
    while (i >= 0) {
      const ns = parseNumstatLine(lines[i]);
      if (!ns) break;
      paths.unshift(ns);
      i--;
    }
    const head = lines.slice(0, i + 1).join('\n');
    const parts = head.split(FIELD);
    if (parts.length < 6) continue;

    const commit = {
      hash: parts[0],
      author: parts[1],
      email: parts[2],
      date: parts[3],
      subject: parts[4],
      body: parts.slice(5).join(FIELD),
      paths,
      insertions: paths.reduce((s, p) => s + p.ins, 0),
      deletions: paths.reduce((s, p) => s + p.del, 0),
      files: paths.length
    };
    commit.agents = detectAgents(commit.subject, commit.body);
    commits.push(commit);
  }
  return { repo, repoName, commits };
}

module.exports = { scanRepo };
