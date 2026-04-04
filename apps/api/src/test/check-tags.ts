// Check tags in database

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { agentTags, marketplaceAgents, tags } from '../db/schema';

async function checkTags() {
  console.log('\n=== Checking Tags in Database ===\n');

  // Get all agents
  const agents = await db.select().from(marketplaceAgents);
  console.log(`Total agents: ${agents.length}`);

  for (const agent of agents) {
    console.log(`\nAgent: ${agent.name} (${agent.slug})`);

    // Get tags for this agent
    const agentTagsResult = await db
      .select({
        agentId: agentTags.agentId,
        tagId: agentTags.tagId,
        tag: tags,
      })
      .from(agentTags)
      .innerJoin(tags, eq(agentTags.tagId, tags.id))
      .where(eq(agentTags.agentId, agent.id));

    if (agentTagsResult.length === 0) {
      console.log('  ❌ No tags found');
    } else {
      console.log(`  ✅ Tags (${agentTagsResult.length}):`);
      for (const at of agentTagsResult) {
        console.log(`     - ${at.tag.name} (slug: ${at.tag.slug}, usage: ${at.tag.usageCount})`);
      }
    }
  }

  // Get all tags
  console.log('\n=== All Tags in Database ===');
  const allTags = await db.select().from(tags);
  console.log(`Total tags: ${allTags.length}`);
  for (const tag of allTags) {
    console.log(`  - ${tag.name} (slug: ${tag.slug}, usage: ${tag.usageCount})`);
  }

  // Get all agent_tags relations
  console.log('\n=== All Agent-Tag Relations ===');
  const allAgentTags = await db.select().from(agentTags);
  console.log(`Total relations: ${allAgentTags.length}`);

  process.exit(0);
}

checkTags().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
