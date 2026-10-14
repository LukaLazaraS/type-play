// Confirms the game agent's session is isolated: prints the tools, MCP servers and skills it
// gets, and the size of its first call. Run: node tests/isolation.mjs
import { query } from '@anthropic-ai/claude-agent-sdk';

const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'];
for await (const m of query({
  prompt: 'Reply with the single word OK.',
  options: {
    model: 'claude-haiku-5-5', maxTurns: 1,
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    tools: TOOLS, settingSources: [], settings: { disableClaudeAiConnectors: true },
    strictMcpConfig: true, mcpServers: {}, skills: [],
  },
})) {
  if (m.type === 'system' && m.subtype === 'init') {
    console.log('tools:', m.tools.length, m.tools.join(', '));
    console.log('mcp servers:', JSON.stringify(m.mcp_servers));
    console.log('skills:', (m.skills || []).length, 'agents:', (m.agents || []).length);
  }
  if (m.type === 'assistant') {
    const u = m.message.usage;
    console.log('first call context:', u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens, 'tokens');
  }
}
