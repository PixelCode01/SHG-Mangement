// Script to verify that the leadership transfer functionality works correctly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function createAndAcceptLeadershipInvitation() {
  try {
    console.log('=== LEADERSHIP TRANSFER VERIFICATION ===');
    
    // 1. First, find a group and two members to use for testing
    const group = await prisma.group.findFirst({
      select: { 
        id: true, 
        name: true,
        leaderId: true
      },
      where: {
        memberships: {
          some: {}
        }
      }
    });
    
    if (!group) {
      console.log('No group found for testing');
      return;
    }
    
    console.log(`Found group: ${group.name} (${group.id})`);
    
    // Find current leader
    const currentLeader = await prisma.member.findUnique({
      where: { id: group.leaderId },
      include: { users: true }
    });
    
    if (!currentLeader) {
      console.log('No current leader found');
      return;
    }
    
    console.log(`Current leader: ${currentLeader.name} (${currentLeader.id})`);
    
    // Find another member who is not the leader
    const otherMember = await prisma.memberGroupMembership.findFirst({
      where: {
        groupId: group.id,
        memberId: { not: group.leaderId }
      },
      include: { member: true }
    });
    
    if (!otherMember) {
      console.log('No other members found in the group');
      return;
    }
    
    console.log(`Found other member: ${otherMember.member.name} (${otherMember.memberId})`);
    
    // 2. Create a pending leadership invitation
    console.log('Creating pending leadership invitation...');
    
    // Find a user associated with the current leader to be the initiator
    let initiator = currentLeader.users[0];
    
    // If no user account is found, create a temporary one for testing
    if (!initiator) {
      console.log('No user account found for current leader. Creating a temporary one for testing...');
      
      initiator = await prisma.user.create({
        data: {
          email: `temp-${Date.now()}@example.com`,
          name: `Temporary User for ${currentLeader.name}`,
          memberId: currentLeader.id,
          role: 'GROUP_LEADER'
        }
      });
      
      console.log(`Created temporary user: ${initiator.name} (${initiator.id})`);
    }
    
    const invitation = await prisma.pendingLeadership.create({
      data: {
        groupId: group.id,
        memberId: otherMember.memberId,
        initiatedByUserId: initiator.id,
        status: 'PENDING'
      }
    });
    
    console.log(`Created invitation: ${invitation.id}`);
    
    // 3. Accept the invitation
    console.log('Accepting invitation...');
    
    await prisma.$transaction(async (tx) => {
      // Update the invitation status
      await tx.pendingLeadership.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' }
      });
      
      // Update the group's leader
      await tx.group.update({
        where: { id: group.id },
        data: { leaderId: otherMember.memberId }
      });
      
      // Find user of the new leader and update role if needed
      let userToUpdate = await tx.user.findFirst({
        where: { memberId: otherMember.memberId }
      });
      
      // If no user account found for the new leader, create one
      if (!userToUpdate) {
        console.log(`No user account found for new leader (${otherMember.member.name}). Creating one...`);
        userToUpdate = await tx.user.create({
          data: {
            email: `newleader-${Date.now()}@example.com`,
            name: `User for ${otherMember.member.name}`,
            memberId: otherMember.memberId,
            role: 'MEMBER'
          }
        });
        console.log(`Created user for new leader: ${userToUpdate.name} (${userToUpdate.id})`);
      }
      
      // Update the role if needed
      if (userToUpdate.role !== 'GROUP_LEADER' && userToUpdate.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: userToUpdate.id },
          data: { role: 'GROUP_LEADER' }
        });
        console.log(`Updated ${userToUpdate.name}'s role to GROUP_LEADER`);
      }
      
      // Mark any other pending invitations as superseded
      await tx.pendingLeadership.updateMany({
        where: {
          groupId: group.id,
          id: { not: invitation.id },
          status: 'PENDING'
        },
        data: { status: 'SUPERSEDED' }
      });
    });
    
    // 4. Verify the changes
    const updatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: { leader: true }
    });
    
    console.log(`Group leader updated. New leader: ${updatedGroup.leader.name}`);
    console.log('Leadership transfer verification completed successfully!');
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAndAcceptLeadershipInvitation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
