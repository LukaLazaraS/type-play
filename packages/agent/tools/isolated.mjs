// The game agent's models and its isolation, in one place: run.mjs builds with them, and tools/pitch.mjs makes its call
// with them from run.mjs and from the server's backfill (apps/server `admin gallery pitch`).

export const MODELS = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' };
export const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'];
// The game agent sees only its own 7 tools. Without this it inherits the login's claude.ai
// connectors (Luka's Google Drive, vidIQ/YouTube, Docs: 84 tools, +89K tokens per call),
// skills, MCP servers, and this repo's CLAUDE.md and settings.
export const ISOLATED = {
  tools: TOOLS,
  settingSources: [],
  settings: { disableClaudeAiConnectors: true },
  strictMcpConfig: true,
  mcpServers: {},
  skills: [],
};
