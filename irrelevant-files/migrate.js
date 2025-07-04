// Import Prisma client directly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateGroups() {
  try {
    // Get all groups without groupId or with null groupId
    const groupsWithoutId = await prisma.group.findMany({
      where: {
        OR: [
          { groupId: null },
          { groupId: { equals: undefined } },
          { groupId: { equals: "" } }
        ]
      }
    });

    console.log(`Found ${groupsWithoutId.length} groups without proper groupId.`);

    if (groupsWithoutId.length === 0) {
      return;
    }

    // Prepare batch updates
    const updatePromises = groupsWithoutId.map(async (group, index) => {
      // Use creation date if available, otherwise use current date
      const date = group.createdAt || new Date();
      const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Create a sequential ID based on the index
      const sequentialNumber = index + 1;
      const groupId = `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;
      
      // Update the group with the new ID
      return prisma.group.update({
        where: { id: group.id },
        data: { groupId }
      });
    });

    // Execute all updates
    const results = await Promise.all(updatePromises);
    console.log(`Successfully updated ${results.length} groups with new groupIds.`);
    
    return results;
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

async function runMigrations() {
  console.log('Running database migrations...');

  try {
    await migrateGroups();
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigrations(); 