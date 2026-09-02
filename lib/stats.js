'use strict';

const { AGENTS } = require('./detect');

const NAME_BY_ID = {};
for (const a of AGENTS) NAME_BY_ID[a.id] = a.name;

function round2(v) {
  return Math.round(v * 100) / 100;
}

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

function computeGrade(commits, daysSinceLast, share) {
  let score = 0;
  if (commits >= 100) score += 3;
  else if (commits >= 50) score += 2;
  else if (commits >= 20) score += 1;
  if (daysSinceLast <= 7) score += 3;
  else if (daysSinceLast <= 30) score += 2;
  else if (daysSinceLast <= 90) score += 1;
  if (share >= 0.5) score += 2;
  else if (share >= 0.2) score += 1;
  if (score >= 7) return 'S';
  if (score >= 5) return 'A';
  if (score >= 3) return 'B';
  return 'C';
}

function extOf(p) {
  const base = p.split('/').pop();
  const i = base.lastIndexOf('.');
  if (i <= 0) return null;
  return base.slice(i + 1).toLowerCase();
}

function computeStats(commits, opts) {
  opts = opts || {};
  const weeks = opts.weeks || 26;
  const now = opts.now ? new Date(opts.now) : new Date();

  const totalCommits = commits.length;
  let aiCommits = 0;
  let aiLines = 0;
  const byAgent = new Map();
  const extMap = new Map();

  for (const c of commits) {
    const isAI = c.agents.length > 0;
    if (isAI) {
      aiCommits++;
      aiLines += c.insertions + c.deletions;
    }
    for (const id of c.agents) {
      if (!byAgent.has(id)) {
        byAgent.set(id, { id, commits: 0, insertions: 0, deletions: 0, files: 0, first: c.date, last: c.date });
      }
      const a = byAgent.get(id);
      a.commits++;
      a.insertions += c.insertions;
      a.deletions += c.deletions;
      a.files += c.files;
      if (c.date < a.first) a.first = c.date;
      if (c.date > a.last) a.last = c.date;
    }
    if (isAI) {
      for (const p of c.paths) {
        const ext = extOf(p.file);
        if (!ext) continue;
        extMap.set(ext, (extMap.get(ext) || 0) + p.ins + p.del);
      }
    }
  }

  const agents = Array.from(byAgent.values())
    .map(a => {
      const daysSinceLast = Math.max(0, Math.floor((now - new Date(a.last)) / 86400000));
      const share = aiCommits > 0 ? a.commits / aiCommits : 0;
      return Object.assign({}, a, {
        name: NAME_BY_ID[a.id] || a.id,
        share: round2(share),
        daysSinceLast,
        grade: computeGrade(a.commits, daysSinceLast, share)
      });
    })
    .sort((x, y) => y.commits - x.commits);

  const dayNow = (now.getUTCDay() + 6) % 7;
  const mondayNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayNow);
  const weekArr = [];
  const weekIndex = new Map();
  for (let i = 0; i < weeks; i++) {
    const monday = new Date(mondayNow - 7 * (weeks - 1 - i) * 86400000).toISOString().slice(0, 10);
    weekIndex.set(monday, i);
    weekArr.push({ week: monday, ai: 0, human: 0 });
  }
  for (const c of commits) {
    const idx = weekIndex.get(weekKey(c.date));
    if (idx === undefined) continue;
    if (c.agents.length > 0) weekArr[idx].ai++;
    else weekArr[idx].human++;
  }

  const topExtensions = Array.from(extMap.entries())
    .map(entry => ({ ext: entry[0], lines: entry[1] }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  return {
    repo: opts.repoName || '',
    generatedAt: now.toISOString(),
    totalCommits,
    aiCommits,
    aiShare: totalCommits > 0 ? Math.round((aiCommits / totalCommits) * 100) : 0,
    aiLines,
    agents,
    weeks: weekArr,
    topExtensions,
    firstDate: commits.length ? commits[commits.length - 1].date : null,
    lastDate: commits.length ? commits[0].date : null
  };
}

module.exports = { computeStats };
