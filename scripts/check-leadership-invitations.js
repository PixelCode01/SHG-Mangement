// Simple script to check existing leadership invitations
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeadershipInvitations() {
  try {
    console.log('Connecting to database...');
    
    // List all pending leadership invitations
    const pendingInvitations = await prisma.pendingLeadership.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        group: true,
        member: true
      }
    });
    
    console.log(`Found ${pendingInvitations.length} pending leadership invitations:`);
    
    pendingInvitations.forEach((invitation, index) => {
      console.log(`\nInvitation ${index + 1}:`);
      console.log(`- ID: ${invitation.id}`);
      console.log(`- Group: ${invitation.group.name} (${invitation.group.id})`);
      console.log(`- Member invited: ${invitation.member.name} (${invitation.member.id})`);
      console.log(`- Current status: ${invitation.status}`);
      console.log(`- Created at: ${invitation.createdAt}`);
    });
    
    // List all groups with their leaders
    const groups = await prisma.group.findMany({
      include: {
        leader: true
      },
      take: 5 // Limit to 5 groups for brevity
    });
    
    console.log(`\nFound ${groups.length} groups:`);
    
    groups.forEach((group, index) => {
      console.log(`\nGroup ${index + 1}:`);
      console.log(`- Name: ${group.name} (${group.id})`);
      console.log(`- Group ID: ${group.groupId}`);
      console.log(`- Leader: ${group.leader ? group.leader.name : 'No leader'} (${group.leader ? group.leader.id : 'None'})`);
    });
    
  } catch (error) {
    console.error('Error checking leadership invitations:', error);
  } finally {
    console.log('\nDisconnecting from database...');
    await prisma.$disconnect();
  }
}

checkLeadershipInvitations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
