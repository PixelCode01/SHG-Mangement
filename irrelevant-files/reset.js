// Import Prisma client directly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('Resetting database...');

  try {
    // Delete all existing groups
    await prisma.group.deleteMany({});
    console.log('All groups deleted');

    // Optional: Delete other entities if needed
    // await prisma.member.deleteMany({});
    // console.log('All members deleted');

    console.log('Database reset completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase(); 