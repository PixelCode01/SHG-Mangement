const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getGroupId() {
  try {
    const group = await prisma.group.findFirst({
      where: { name: 'bcv' },
      select: { id: true, name: true }
    });

    if (group) {
      console.log(`Group "${group.name}" ID: ${group.id}`);
      console.log(`\nTo test the periodic record form, navigate to:`);
      console.log(`http://localhost:3003/groups/${group.id}/periodic-records/create`);
    } else {
      console.log('Group not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getGroupId();
