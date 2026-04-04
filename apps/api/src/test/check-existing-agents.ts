// Check existing agents details
import { db } from '../db/client';
import { marketplaceAgents } from '../db/schema';

async function checkExistingAgents() {
  console.log('\n=== Existing Agents Details ===\n');

  const agents = await db.select().from(marketplaceAgents);

  for (const agent of agents) {
    console.log(`\nAgent: ${agent.name}`);
    console.log(`  Slug: ${agent.slug}`);
    console.log(`  Created at: ${agent.createdAt}`);
    console.log(`  Published: ${agent.isPublished}`);
    console.log(`  Published at: ${agent.publishedAt}`);
  }

  process.exit(0);
}

checkExistingAgents().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
