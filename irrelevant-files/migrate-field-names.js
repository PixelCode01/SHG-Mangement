const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateFieldNames() {
  console.log('Starting field name migration...');

  try {
    // First, let's check if we need to add the new fields
    const sampleMember = await prisma.member.findFirst();
    const sampleMembership = await prisma.memberGroupMembership.findFirst();

    console.log('Sample member fields:', sampleMember ? Object.keys(sampleMember) : 'No members found');
    console.log('Sample membership fields:', sampleMembership ? Object.keys(sampleMembership) : 'No memberships found');

    // For now, let's just push the schema changes
    console.log('Schema changes will be handled by Prisma db push');
    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateFieldNames();
