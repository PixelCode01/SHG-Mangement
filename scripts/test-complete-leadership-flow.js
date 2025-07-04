/**
 * Test script to verify the complete leadership invitation flow works
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCompleteFlow() {
  try {
    console.log('🧪 Testing complete leadership invitation flow...\n');

    // 1. Find existing users and groups for testing
    console.log('1. Finding existing data for testing...');
    
    // Find a member user
    const memberUser = await prisma.user.findFirst({
      where: { role: 'MEMBER' },
      include: { member: true }
    });
    
    if (!memberUser || !memberUser.member) {
      console.log('❌ No MEMBER user found. Please create a member user first.');
      return;
    }
    
    console.log(`Found member user: ${memberUser.email} with role: ${memberUser.role}`);
    
    // Find a group that this member is not leading
    const availableGroup = await prisma.group.findFirst({
      where: {
        leaderId: { not: memberUser.member.id }
      },
      include: { leader: true }
    });
    
    if (!availableGroup) {
      console.log('❌ No available group found for testing.');
      return;
    }
    
    console.log(`Found test group: "${availableGroup.name}" currently led by: ${availableGroup.leader?.name}`);

    // 2. Create a pending leadership invitation
    console.log('\n2. Creating pending leadership invitation...');
    
    // Clean up any existing pending invitations first
    await prisma.pendingLeadership.deleteMany({
      where: {
        groupId: availableGroup.id,
        memberId: memberUser.member.id
      }
    });
    
    const pendingInvitation = await prisma.pendingLeadership.create({
      data: {
        groupId: availableGroup.id,
        memberId: memberUser.member.id,
        status: 'PENDING'
      }
    });
    
    console.log(`✅ Created pending invitation: ${pendingInvitation.id}`);

    // 3. Verify initial state
    console.log('\n3. Verifying initial state...');
    
    const initialUser = await prisma.user.findUnique({
      where: { id: memberUser.id }
    });
    
    console.log(`User role before accepting invitation: ${initialUser?.role}`);
    
    if (initialUser?.role !== 'MEMBER') {
      console.log('❌ Expected user to have MEMBER role initially');
      return;
    }

    // 4. Simulate accepting the invitation (like the API endpoint does)
    console.log('\n4. Simulating invitation acceptance...');
    
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      const updatedInvitation = await tx.pendingLeadership.update({
        where: { id: pendingInvitation.id },
        data: { status: 'ACCEPTED' }
      });
      
      // Update group leader
      await tx.group.update({
        where: { id: availableGroup.id },
        data: { leaderId: memberUser.member.id }
      });
      
      // Update user role
      const userToUpdate = await tx.user.findFirst({
        where: { memberId: memberUser.member.id }
      });
      
      if (userToUpdate && userToUpdate.role !== 'GROUP_LEADER' && userToUpdate.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: userToUpdate.id },
          data: { role: 'GROUP_LEADER' }
        });
        console.log(`✅ Updated user role to GROUP_LEADER`);
      }
      
      // Mark other pending invitations as superseded
      await tx.pendingLeadership.updateMany({
        where: {
          groupId: availableGroup.id,
          id: { not: pendingInvitation.id },
          status: 'PENDING'
        },
        data: { status: 'SUPERSEDED' }
      });
      
      return updatedInvitation;
    });
    
    console.log(`✅ Invitation accepted: ${result.status}`);

    // 5. Verify final state
    console.log('\n5. Verifying final state...');
    
    const finalUser = await prisma.user.findUnique({
      where: { id: memberUser.id }
    });
    
    const updatedGroup = await prisma.group.findUnique({
      where: { id: availableGroup.id },
      include: { leader: true }
    });
    
    console.log(`User role after acceptance: ${finalUser?.role}`);
    console.log(`Group leader after acceptance: ${updatedGroup?.leader?.name}`);
    
    // Verify role was updated
    if (finalUser?.role !== 'GROUP_LEADER') {
      console.log(`❌ Expected user role to be GROUP_LEADER, got: ${finalUser?.role}`);
      return;
    }
    
    // Verify group leadership was updated
    if (updatedGroup?.leader?.id !== memberUser.member.id) {
      console.log('❌ Expected group leader to be updated');
      return;
    }

    // 6. Test group access (simulate the groups API logic)
    console.log('\n6. Testing group access after role change...');
    
    // Simulate groups API for GROUP_LEADER role
    const leaderGroups = await prisma.user.findUnique({
      where: { id: memberUser.id },
      select: {
        member: {
          select: {
            ledGroups: {
              include: {
                leader: { select: { id: true, name: true } },
                memberships: { select: { memberId: true } }
              }
            }
          }
        }
      }
    });
    
    console.log(`Groups led by user: ${leaderGroups?.member?.ledGroups?.length || 0}`);
    
    if ((leaderGroups?.member?.ledGroups?.length || 0) === 0) {
      console.log('❌ Expected user to have access to at least one group as leader');
      return;
    }
    
    console.log('✅ Group access verification passed!');
    
    // 7. Test session refresh query (what the auth callback uses)
    console.log('\n7. Testing session refresh query...');
    
    const sessionData = await prisma.user.findUnique({
      where: { id: memberUser.id },
      select: { role: true, memberId: true, email: true, name: true }
    });
    
    console.log('Session data that would be refreshed:', sessionData);
    
    if (sessionData?.role !== 'GROUP_LEADER') {
      console.log('❌ Session refresh would not show updated role');
      return;
    }
    
    console.log('✅ Session refresh query works correctly!');
    
    console.log('\n🎉 All tests passed! The complete leadership invitation flow works correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCompleteFlow();
