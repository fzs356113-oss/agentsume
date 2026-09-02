'use strict';

const AGENTS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    color: '#d97757',
    signatures: [
      /generated with \[?claude code\]?/i,
      /co-authored-by:\s*claude\s*(?:<[^>]*anthropic[^>]*>)?/i,
      /claude\s*<noreply@anthropic\.com>/i
    ]
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    color: '#10a37f',
    signatures: [
      /generated with codex/i,
      /co-authored-by:\s*codex\s*(?:<[^>]*openai[^>]*>)?/i,
      /codex\s*<noreply@openai\.com>/i
    ]
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    color: '#8957e5',
    signatures: [
      /copilot\s*<(?:198982749\+)?copilot@/i,
      /co-authored-by:\s*(?:github\s+)?copilot/i
    ]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    color: '#55b8d4',
    signatures: [
      /generated with cursor/i,
      /co-authored-by:\s*cursor/i,
      /cursor agent/i
    ]
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    color: '#4285f4',
    signatures: [
      /generated with gemini/i,
      /co-authored-by:\s*gemini/i
    ]
  },
  {
    id: 'aider',
    name: 'Aider',
    color: '#22c55e',
    signatures: [
      /^aider:/im,
      /co-authored-by:\s*aider/i
    ]
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    color: '#f59e0b',
    signatures: [
      /generated with windsurf/i,
      /co-authored-by:\s*windsurf/i,
      /co-authored-by:\s*codeium/i
    ]
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    color: '#a3e635',
    signatures: [
      /generated with opencode/i,
      /co-authored-by:\s*opencode/i
    ]
  },
  {
    id: 'trae',
    name: 'Trae',
    color: '#e879f9',
    signatures: [
      /generated with trae/i,
      /co-authored-by:\s*trae/i
    ]
  },
  {
    id: 'crush',
    name: 'Crush',
    color: '#fb7185',
    signatures: [
      /generated with crush/i,
      /co-authored-by:\s*crush/i
    ]
  }
];

function detectAgents(subject, body) {
  const text = (subject || '') + '\n' + (body || '');
  const ids = [];
  for (const agent of AGENTS) {
    for (const sig of agent.signatures) {
      if (sig.test(text)) {
        ids.push(agent.id);
        break;
      }
    }
  }
  return ids;
}

module.exports = { AGENTS, detectAgents };
