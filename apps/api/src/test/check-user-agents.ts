// Check user agents publication status

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { marketplaceAgents, users } from '../db/schema';

async function checkUserAgents() {
  try {
    // List all users first
    console.log('📋 Listing all users in database:\n');
    const allUsers = await db.select().from(users);

    if (allUsers.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    for (const user of allUsers) {
      console.log(`\n👤 User: ${user.name}`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);

      // Get all agents by this user
      const allAgents = await db
        .select()
        .from(marketplaceAgents)
        .where(eq(marketplaceAgents.authorId, user.id));

      console.log(`   - Total agents: ${allAgents.length}`);

      if (allAgents.length > 0) {
        allAgents.forEach((agent, index) => {
          console.log(`     ${index + 1}. ${agent.name} (${agent.slug})`);
          console.log(`        - Published: ${agent.isPublished ? '✅ YES' : '❌ NO'}`);
          console.log(`        - Installs: ${agent.installCount}`);
        });

        // Count published agents
        const publishedAgents = allAgents.filter((a) => a.isPublished);
        console.log(`   - ✅ Published: ${publishedAgents.length}`);
        console.log(`   - ❌ Unpublished: ${allAgents.length - publishedAgents.length}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkUserAgents();
