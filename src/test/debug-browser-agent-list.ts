import { agentRegistry } from '@/services/agents/agent-registry';

async function main() {
  agentRegistry.reset();
  await agentRegistry.loadAllAgents();
  const visibleSystemAgents = agentRegistry
    .list()
    .filter((agent) => agent.isDefault && !agent.hidden)
    .map((agent) => `${agent.id}:${agent.name}`);

  console.log(visibleSystemAgents.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
