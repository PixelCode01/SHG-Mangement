const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing Prisma connection...');
    const count = await prisma.group.count();
    console.log(`Found ${count} groups in database`);
    
    const groupsWithMembers = await prisma.group.findMany({
      where: {
        memberCount: { gte: 10 }
      },
      select: {
        id: true,
        name: true,
        memberCount: true
      }
    });
    
    console.log('Groups with 10+ members:');
    groupsWithMembers.forEach(group => {
      console.log(`- ${group.name}: ${group.memberCount} members (ID: ${group.id})`);
    });
    
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
