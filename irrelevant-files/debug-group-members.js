const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugGroupMembers() {
  try {
    const groupId = '6839df25d8623d3926880f12';
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalGroupStandingAtEndOfPeriod: true }
        }
      }
    });

    if (!group) {
      console.log('Group not found');
      return;
    }

    console.log('Group Debug Info:');
    console.log('- Group ID:', group.id);
    console.log('- Group Name:', group.name);
    console.log('- Memberships Count:', group.memberships.length);
    console.log('- Members:', group.memberships.map(m => ({ id: m.member.id, name: m.member.name })));
    console.log('- Latest Record:', group.groupPeriodicRecords[0]);
    console.log('- Total Group Standing:', group.groupPeriodicRecords[0]?.totalGroupStandingAtEndOfPeriod || 0);
    
    const totalGroupStanding = group.groupPeriodicRecords[0]?.totalGroupStandingAtEndOfPeriod || 0;
    const numberOfMembers = group.memberships.length;
    const sharePerMember = numberOfMembers > 0 ? totalGroupStanding / numberOfMembers : 0;
    
    console.log('- Calculated Share per Member:', sharePerMember);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGroupMembers();
