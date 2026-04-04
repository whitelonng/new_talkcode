// Database seed script - populate with initial data

import { DEFAULT_CATEGORIES } from '@talkcody/shared';
import { db } from './client';
import { categories, collections, tags } from './schema';

console.log('🌱 Seeding database...');

try {
  // Seed categories
  console.log('Creating categories...');
  const createdCategories = await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map(
        (cat: { name: string; slug: string; icon: string }, index: number) => ({
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          displayOrder: index,
        })
      )
    )
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${createdCategories.length} categories`);

  // Seed some default tags
  console.log('Creating default tags...');
  const defaultTags = [
    'typescript',
    'javascript',
    'python',
    'react',
    'vue',
    'nodejs',
    'debugging',
    'code-review',
    'documentation',
    'testing',
  ];

  const createdTags = await db
    .insert(tags)
    .values(
      defaultTags.map((name) => ({
        name,
        slug: name.toLowerCase(),
      }))
    )
    .onConflictDoNothing()
    .returning();

  console.log(`✅ Created ${createdTags.length} tags`);

  // Seed featured collection
  console.log('Creating featured collection...');
  await db
    .insert(collections)
    .values({
      name: 'Featured Agents',
      slug: 'featured',
      description: 'Hand-picked collection of the best agents',
      icon: '⭐',
      isFeatured: true,
      displayOrder: 0,
    })
    .onConflictDoNothing();

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
