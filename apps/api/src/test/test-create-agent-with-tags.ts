// Test creating agent with tags

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { agentTags, marketplaceAgents, tags, users } from '../db/schema';
import { AgentService } from '../services/agent-service';

async function testCreateAgentWithTags() {
  console.log('\n=== Testing Create Agent with Tags ===\n');

  // Find or create a test user
  const testUser = await db.select().from(users).limit(1);
  let userId: string;

  if (testUser.length === 0) {
    console.log('Creating test user...');
    const newUser = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
      })
      .returning();
    userId = newUser[0].id;
    console.log(`Created test user: ${userId}`);
  } else {
    userId = testUser[0].id;
    console.log(`Using existing user: ${userId}`);
  }

  // Create agent with tags
  const agentService = new AgentService();

  console.log('\nCreating agent with tags: ["ai", "chat", "assistant"]');

  try {
    const agent = await agentService.createAgent(userId, {
      name: 'Test Agent with Tags',
      description: 'Testing tags functionality',
      model: 'deepseek-reasoner',
      systemPrompt: 'You are a helpful assistant',
      categoryIds: ['coding'],
      tags: ['ai', 'chat', 'assistant'],
    });

    console.log(`\n✅ Agent created: ${agent.name} (${agent.id})`);

    // Check if tags were created
    console.log('\nChecking tags table...');
    const createdTags = await db.select().from(tags).where(eq(tags.slug, 'ai'));

    console.log(`Tags in DB: ${createdTags.length}`);
    for (const tag of createdTags) {
      console.log(`  - ${tag.name} (slug: ${tag.slug})`);
    }

    // Check if agent-tag relations were created
    console.log('\nChecking agent_tags table...');
    const agentTagsRelations = await db
      .select()
      .from(agentTags)
      .where(eq(agentTags.agentId, agent.id));

    console.log(`Agent-tag relations: ${agentTagsRelations.length}`);

    if (agentTagsRelations.length === 3) {
      console.log('✅ All tags were linked correctly!');
    } else {
      console.log(`❌ Expected 3 relations, got ${agentTagsRelations.length}`);
    }

    // Get full tags with names
    const fullTags = await db
      .select({
        agentId: agentTags.agentId,
        tag: tags,
      })
      .from(agentTags)
      .innerJoin(tags, eq(agentTags.tagId, tags.id))
      .where(eq(agentTags.agentId, agent.id));

    console.log('\nTags linked to agent:');
    for (const ft of fullTags) {
      console.log(`  - ${ft.tag.name}`);
    }

    // Clean up - delete test agent
    console.log('\nCleaning up test agent...');
    await db.delete(marketplaceAgents).where(eq(marketplaceAgents.id, agent.id));
    console.log('Test agent deleted');
  } catch (error) {
    console.error('❌ Error creating agent:', error);
  }

  process.exit(0);
}

testCreateAgentWithTags().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
