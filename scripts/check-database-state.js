const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log('Existing users:');
    users.forEach(user => {
      console.log(`- ${user.email}: ${user.role} (memberId: ${user.memberId}, member: ${user.member?.name || 'None'})`);
    });
    
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        groupId: true,
        leaderId: true,
        leader: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('\nExisting groups:');
    groups.forEach(group => {
      console.log(`- ${group.name} (${group.groupId}): led by ${group.leader?.name || 'No leader'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
