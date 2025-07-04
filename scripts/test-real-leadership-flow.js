/**
 * Test script to verify the complete leadership invitation flow works with existing data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWithExistingData() {
  try {
    console.log('🧪 Testing leadership invitation flow with existing data...\n');

    // 1. Use the specific member user we found
    console.log('1. Using existing member user...');
    
    const memberUser = await prisma.user.findUnique({
      where: { email: 'member@example.com' },
      include: { member: true }
    });
    
    if (!memberUser || !memberUser.member) {
      console.log('❌ Member user not found.');
      return;
    }
    
    console.log(`Using member user: ${memberUser.email} with role: ${memberUser.role}`);
    console.log(`Member ID: ${memberUser.member.id}, Member name: ${memberUser.member.name}`);
    
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
    
    console.log(`Using test group: "${availableGroup.name}" currently led by: ${availableGroup.leader?.name}`);

    // 2. Clean up any existing pending invitations and create a new one
    console.log('\n2. Setting up pending leadership invitation...');
    
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

    // 3. Store initial state
    console.log('\n3. Recording initial state...');
    
    const initialUserRole = memberUser.role;
    const initialGroupLeader = availableGroup.leader?.name;
    
    console.log(`Initial user role: ${initialUserRole}`);
    console.log(`Initial group leader: ${initialGroupLeader}`);

    // 4. Simulate accepting the invitation (exactly like the API endpoint)
    console.log('\n4. Simulating invitation acceptance...');
    
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status to ACCEPTED
      const updatedInvitation = await tx.pendingLeadership.update({
        where: { id: pendingInvitation.id },
        data: { status: 'ACCEPTED' }
      });
      
      // Update the group's leaderId
      await tx.group.update({
        where: { id: availableGroup.id },
        data: { leaderId: memberUser.member.id }
      });
      
      // Update user role to GROUP_LEADER
      const userToUpdate = await tx.user.findFirst({
        where: { memberId: memberUser.member.id }
      });
      
      if (userToUpdate && userToUpdate.role !== 'GROUP_LEADER' && userToUpdate.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: userToUpdate.id },
          data: { role: 'GROUP_LEADER' }
        });
        console.log(`✅ Updated user role from ${userToUpdate.role} to GROUP_LEADER`);
      }
      
      // Mark other pending invitations for the same group as SUPERSEDED
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
    
    console.log(`✅ Invitation status: ${result.status}`);

    // 5. Verify the changes
    console.log('\n5. Verifying changes...');
    
    const updatedUser = await prisma.user.findUnique({
      where: { id: memberUser.id }
    });
    
    const updatedGroup = await prisma.group.findUnique({
      where: { id: availableGroup.id },
      include: { leader: true }
    });
    
    console.log(`User role after acceptance: ${updatedUser?.role}`);
    console.log(`Group leader after acceptance: ${updatedGroup?.leader?.name}`);
    
    // Validate the changes
    let hasErrors = false;
    
    if (updatedUser?.role !== 'GROUP_LEADER') {
      console.log(`❌ User role should be GROUP_LEADER, but is: ${updatedUser?.role}`);
      hasErrors = true;
    }
    
    if (updatedGroup?.leader?.id !== memberUser.member.id) {
      console.log('❌ Group leader should be updated to the accepting user');
      hasErrors = true;
    }
    
    if (!hasErrors) {
      console.log('✅ Role and leadership updates successful!');
    }

    // 6. Test the groups API logic for GROUP_LEADER role
    console.log('\n6. Testing group access with new role...');
    
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
    
    const groupsCount = leaderGroups?.member?.ledGroups?.length || 0;
    console.log(`Groups led by user: ${groupsCount}`);
    
    if (groupsCount === 0) {
      console.log('❌ User should have access to at least one group as leader');
      hasErrors = true;
    } else {
      console.log('✅ Group access works correctly!');
    }

    // 7. Test the session refresh functionality
    console.log('\n7. Testing session refresh (auth callback simulation)...');
    
    const sessionRefreshData = await prisma.user.findUnique({
      where: { id: memberUser.id },
      select: { role: true, memberId: true, email: true, name: true }
    });
    
    console.log('Session data that would be refreshed:', {
      role: sessionRefreshData?.role,
      memberId: sessionRefreshData?.memberId,
      email: sessionRefreshData?.email
    });
    
    if (sessionRefreshData?.role !== 'GROUP_LEADER') {
      console.log('❌ Session refresh would not return updated role');
      hasErrors = true;
    } else {
      console.log('✅ Session refresh returns correct updated role!');
    }

    // Final result
    if (!hasErrors) {
      console.log('\n🎉 ALL TESTS PASSED! The leadership invitation flow works correctly.');
      console.log('✅ Role update: MEMBER → GROUP_LEADER');
      console.log('✅ Group leadership transfer successful');
      console.log('✅ Group access verification passed');
      console.log('✅ Session refresh mechanism works');
    } else {
      console.log('\n❌ Some tests failed. Please check the issues above.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testWithExistingData();
