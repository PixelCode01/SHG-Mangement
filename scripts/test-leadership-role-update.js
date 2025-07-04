#!/usr/bin/env node

/**
 * Test script to verify that role updates work correctly after accepting leadership
 * This script tests the entire flow:
 * 1. Create a test user with MEMBER role
 * 2. Create a group with another leader
 * 3. Create a pending leadership invitation
 * 4. Accept the invitation (which should update the role)
 * 5. Verify that the user's role is updated and they can access groups
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLeadershipRoleUpdate() {
  try {
    console.log('🧪 Starting leadership role update test...\n');

    // 1. Find or create a test user with MEMBER role
    console.log('1. Setting up test user...');
    const testEmail = 'test-leadership@example.com';
    
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: { email: testEmail }
    });
    
    // Create a member record first
    const testMember = await prisma.member.create({
      data: {
        name: 'Test Leadership User',
        phoneNumber: '1234567890',
        email: testEmail,
        address: 'Test Address'
      }
    });
    
    // Create the user with MEMBER role
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Test Leadership User',
        password: 'hashedpassword', // In real app this would be hashed
        role: 'MEMBER',
        memberId: testMember.id
      }
    });
    
    console.log(`✅ Created test user: ${testUser.email} with role: ${testUser.role}`);

    // 2. Create a test group with another leader
    console.log('\n2. Setting up test group...');
    
    // Create another member to be the initial leader
    const initialLeader = await prisma.member.create({
      data: {
        name: 'Initial Leader',
        phoneNumber: '9876543210',
        email: 'initial-leader@example.com',
        address: 'Leader Address'
      }
    });
    
    const testGroup = await prisma.group.create({
      data: {
        groupId: 'TEST-GROUP-' + Date.now(),
        name: 'Test Leadership Group',
        leaderId: initialLeader.id,
        address: 'Test Group Address',
        collectionFrequency: 'MONTHLY'
      }
    });
    
    console.log(`✅ Created test group: ${testGroup.name} with leader: ${initialLeader.name}`);

    // 3. Create a pending leadership invitation
    console.log('\n3. Creating pending leadership invitation...');
    
    const pendingInvitation = await prisma.pendingLeadership.create({
      data: {
        groupId: testGroup.id,
        memberId: testMember.id,
        status: 'PENDING',
        invitedBy: initialLeader.id
      }
    });
    
    console.log(`✅ Created pending invitation: ${pendingInvitation.id}`);

    // 4. Test the current state - user should be MEMBER
    console.log('\n4. Verifying initial state...');
    
    const userBeforeAcceptance = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    
    console.log(`User role before acceptance: ${userBeforeAcceptance?.role}`);
    
    if (userBeforeAcceptance?.role !== 'MEMBER') {
      throw new Error('Expected user role to be MEMBER before acceptance');
    }

    // 5. Accept the invitation (simulate the API call logic)
    console.log('\n5. Accepting leadership invitation...');
    
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      const updatedInvitation = await tx.pendingLeadership.update({
        where: { id: pendingInvitation.id },
        data: { status: 'ACCEPTED' }
      });
      
      // Update group leader
      await tx.group.update({
        where: { id: testGroup.id },
        data: { leaderId: testMember.id }
      });
      
      // Update user role to GROUP_LEADER
      const userToUpdate = await tx.user.findFirst({
        where: { memberId: testMember.id }
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
          groupId: testGroup.id,
          id: { not: pendingInvitation.id },
          status: 'PENDING'
        },
        data: { status: 'SUPERSEDED' }
      });
      
      return updatedInvitation;
    });
    
    console.log(`✅ Invitation accepted: ${result.status}`);

    // 6. Verify the final state
    console.log('\n6. Verifying final state...');
    
    const userAfterAcceptance = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    
    const updatedGroup = await prisma.group.findUnique({
      where: { id: testGroup.id },
      include: { leader: true }
    });
    
    console.log(`User role after acceptance: ${userAfterAcceptance?.role}`);
    console.log(`Group leader after acceptance: ${updatedGroup?.leader?.name}`);
    
    // Verify expectations
    if (userAfterAcceptance?.role !== 'GROUP_LEADER') {
      throw new Error(`Expected user role to be GROUP_LEADER, got: ${userAfterAcceptance?.role}`);
    }
    
    if (updatedGroup?.leader?.id !== testMember.id) {
      throw new Error('Expected group leader to be updated to test member');
    }
    
    console.log('\n✅ All tests passed! Role update works correctly.');
    
    // 7. Test group access logic
    console.log('\n7. Testing group access...');
    
    // Simulate the groups API logic for GROUP_LEADER role
    const leaderGroups = await prisma.user.findUnique({
      where: { id: testUser.id },
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
      throw new Error('Expected user to have access to at least one group as leader');
    }
    
    console.log('✅ Group access verification passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete test users
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['test-leadership@example.com', 'initial-leader@example.com']
          }
        }
      });
      
      // Delete test groups (this will cascade to pending leaderships)
      await prisma.group.deleteMany({
        where: {
          name: 'Test Leadership Group'
        }
      });
      
      // Delete test members
      await prisma.member.deleteMany({
        where: {
          email: {
            in: ['test-leadership@example.com', 'initial-leader@example.com']
          }
        }
      });
      
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
    
    await prisma.$disconnect();
  }
}

// Run the test
testLeadershipRoleUpdate();
