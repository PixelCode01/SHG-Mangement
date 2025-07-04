// Test script for leadership transfer workflow
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLeadershipTransfer() {
  try {
    console.log('Starting leadership transfer test...');
    
    // First, let's find a group and member for our test
    const group = await prisma.group.findFirst({
      select: { 
        id: true, 
        name: true,
        leaderId: true
      },
      where: {
        // Find a group that has at least two members
        memberships: {
          some: {}
        }
      }
    });
    
    if (!group) {
      console.log('No suitable group found for testing');
      return;
    }
    
    console.log(`Found group for testing: ${group.name} (${group.id})`);
    
    // Find a member that is not the current leader
    const nonLeaderMember = await prisma.memberGroupMembership.findFirst({
      where: {
        groupId: group.id,
        memberId: {
          not: group.leaderId
        }
      },
      include: {
        member: true
      }
    });
    
    if (!nonLeaderMember) {
      console.log(`No alternative member found for group ${group.name}`);
      return;
    }
    
    console.log(`Found potential new leader: ${nonLeaderMember.member.name} (${nonLeaderMember.memberId})`);
    
    // Create a pending leadership invitation
    const currentLeader = await prisma.member.findUnique({
      where: { id: group.leaderId },
      include: {
        users: true
      }
    });
    
    if (!currentLeader?.users?.[0]) {
      console.log('Current leader user account not found');
      return;
    }
    
    console.log(`Current leader: ${currentLeader.name} (${currentLeader.id})`);
    
    // Create the pending leadership invitation
    const pendingInvitation = await prisma.pendingLeadership.create({
      data: {
        groupId: group.id,
        memberId: nonLeaderMember.memberId,
        initiatedByUserId: currentLeader.users[0].id,
        status: 'PENDING'
      }
    });
    
    console.log(`Created pending leadership invitation: ${pendingInvitation.id}`);
    console.log('Test completed. You can now:');
    console.log(`1. Login with the member ID ${nonLeaderMember.memberId} to see and accept the invitation`);
    console.log(`2. Check the home page for the pending leadership invitation component`);
    console.log(`3. Accept or reject the invitation`);
    console.log(`4. Verify the group leadership has been updated if accepted`);
    
  } catch (error) {
    console.error('Error running leadership transfer test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLeadershipTransfer();
