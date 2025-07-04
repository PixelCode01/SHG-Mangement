// Script to simulate accepting a leadership invitation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The member ID from the previous test script
const targetMemberId = '681c4a3b6c63b8b1322d9e31';

async function acceptLeadershipInvitation() {
  try {
    console.log(`Checking for leadership invitations for member ID: ${targetMemberId}`);
    
    // Find the pending leadership invitation for this member
    const pendingInvitation = await prisma.pendingLeadership.findFirst({
      where: {
        memberId: targetMemberId,
        status: 'PENDING'
      },
      include: {
        group: true
      }
    });
    
    if (!pendingInvitation) {
      console.log('No pending leadership invitations found for this member.');
      return;
    }
    
    console.log(`Found pending invitation: ${pendingInvitation.id} for group ${pendingInvitation.group.name}`);
    
    // Simulate accepting the invitation
    console.log('Accepting the leadership invitation...');
    
    // Update the invitation status to ACCEPTED
    const updatedInvitation = await prisma.$transaction(async (tx) => {
      const result = await tx.pendingLeadership.update({
        where: { id: pendingInvitation.id },
        data: { status: 'ACCEPTED' },
      });
      
      // Update the group's leader ID
      await tx.group.update({
        where: { id: pendingInvitation.groupId },
        data: { leaderId: pendingInvitation.memberId },
      });
      
      // Optional: Update user role if needed
      const userToUpdate = await tx.user.findFirst({
        where: { memberId: pendingInvitation.memberId }
      });
      
      if (userToUpdate && userToUpdate.role !== 'GROUP_LEADER' && userToUpdate.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: userToUpdate.id },
          data: { role: 'GROUP_LEADER' }
        });
        console.log(`Updated user ${userToUpdate.id} role to GROUP_LEADER`);
      }
      
      // Mark other pending invitations for this group as SUPERSEDED
      await tx.pendingLeadership.updateMany({
        where: {
          groupId: pendingInvitation.groupId,
          id: { not: pendingInvitation.id },
          status: 'PENDING'
        },
        data: { status: 'SUPERSEDED' }
      });
      
      return result;
    });
    
    console.log('Invitation accepted successfully:', updatedInvitation);
    
    // Verify the group leadership has been updated
    const updatedGroup = await prisma.group.findUnique({
      where: { id: pendingInvitation.groupId },
      include: {
        leader: true
      }
    });
    
    console.log(`Group leadership updated. New leader: ${updatedGroup?.leader?.name} (ID: ${updatedGroup?.leader?.id})`);
    
  } catch (error) {
    console.error('Error accepting leadership invitation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

acceptLeadershipInvitation().catch(e => {
  console.error("Top level error:", e);
  process.exit(1);
});
