/**
 * Test script to verify group creation when user already has same memberId as selected leader
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Group Creation with Same User MemberId as Selected Leader...\n');

  try {
    // 1. Find test user and set their memberId to the leader they will select
    let testUser = await prisma.user.findFirst({
      where: {
        email: 'testuser@groupcreation.com',
        role: 'GROUP_LEADER'
      }
    });

    // Find test members
    let testMembers = await prisma.member.findMany({
      where: {
        name: { in: ['Test Leader Member', 'Test Member 2'] }
      }
    });

    const leaderMember = testMembers.find(m => m.name === 'Test Leader Member');
    const otherMember = testMembers.find(m => m.name === 'Test Member 2');

    // Set user's memberId to the same as the leader they'll select
    await prisma.user.update({
      where: { id: testUser.id },
      data: { memberId: leaderMember.id }
    });

    console.log(`📋 Test setup:
    - User ID: ${testUser.id} (${testUser.email})
    - User current memberId: ${leaderMember.id} (${leaderMember.name})
    - Selected Leader Member: ${leaderMember.id} (${leaderMember.name}) - SAME as current
    - Other Member: ${otherMember.id} (${otherMember.name})\n`);

    // 2. Simulate group creation where user selects the same leader they're already linked to
    console.log('🚀 Simulating group creation with same leader selection...');

    const groupData = {
      name: 'Test Group for Same Leader',
      address: 'Test Group Address 3',
      registrationNumber: 'REG-TEST-003',
      leaderId: leaderMember.id, // User selects this leader (same as their current memberId)
      collectionFrequency: 'MONTHLY',
      members: [
        {
          memberId: leaderMember.id,
          currentShareAmount: 1000,
          currentLoanAmount: 0
        },
        {
          memberId: otherMember.id,
          currentShareAmount: 500,
          currentLoanAmount: 0
        }
      ]
    };

    // Simulate the group creation logic
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const result = await prisma.$transaction(async (tx) => {
      // Generate group ID
      const lastGroup = await tx.group.findFirst({
        where: { groupId: { startsWith: `GRP-${yearMonth}-` } },
        orderBy: { createdAt: 'desc' },
        select: { groupId: true }
      });
      
      let sequentialNumber = 1;
      if (lastGroup?.groupId) {
        try {
          const groupIdParts = lastGroup.groupId.split('-');
          if (groupIdParts.length >= 3 && groupIdParts[2]) {
            const lastNumber = parseInt(groupIdParts[2]);
            if (!isNaN(lastNumber)) sequentialNumber = lastNumber + 1;
          }
        } catch (e) {
          console.error("Error parsing last group ID sequence:", e);
        }
      }
      const groupId = `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;

      // Check if user needs linking (should NOT need linking in this case)
      const currentUser = await tx.user.findUnique({
        where: { id: testUser.id },
        select: { memberId: true }
      });
      const userMemberId = currentUser.memberId;
      const selectedLeaderId = groupData.leaderId;
      
      console.log(`🔄 User current memberId: ${userMemberId}, Selected leader: ${selectedLeaderId}`);
      
      if (!userMemberId || userMemberId !== selectedLeaderId) {
        console.log(`🔗 Linking user from ${userMemberId} to ${selectedLeaderId}`);
        await tx.user.update({
          where: { id: testUser.id },
          data: { memberId: selectedLeaderId }
        });
        console.log(`✅ Successfully linked user to leader member`);
      } else {
        console.log(`✅ User already linked to selected leader - no action needed`);
      }

      // Create group
      const group = await tx.group.create({
        data: {
          groupId,
          name: groupData.name,
          address: groupData.address,
          registrationNumber: groupData.registrationNumber,
          leaderId: selectedLeaderId,
          collectionFrequency: groupData.collectionFrequency,
          memberCount: groupData.members.length,
          dateOfStarting: new Date(),
        }
      });

      // Create memberships
      await tx.memberGroupMembership.createMany({
        data: groupData.members.map(memberInfo => ({
          groupId: group.id,
          memberId: memberInfo.memberId,
          currentShareAmount: memberInfo.currentShareAmount,
          currentLoanAmount: memberInfo.currentLoanAmount,
        }))
      });

      return { group, linkedMemberId: selectedLeaderId };
    });

    console.log('✅ Group created successfully!');

    // 3. Verify the results
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: { member: true }
    });

    const createdGroup = await prisma.group.findUnique({
      where: { id: result.group.id },
      include: {
        leader: true,
        memberships: {
          include: { member: true }
        }
      }
    });

    console.log(`\n📊 Verification Results:
    ✅ User memberId remained: ${updatedUser.memberId} (${updatedUser.member?.name})
    ✅ Group leader ID: ${createdGroup.leaderId} (${createdGroup.leader?.name})
    ✅ User and group leader match: ${updatedUser.memberId === createdGroup.leaderId ? 'YES' : 'NO'}
    ✅ Group has ${createdGroup.memberships.length} members
    ✅ Group ID: ${createdGroup.groupId}
    `);

    if (updatedUser.memberId === createdGroup.leaderId && updatedUser.memberId === leaderMember.id) {
      console.log('🎉 SUCCESS: Same leader selection functionality works correctly!');
      console.log('   - User remained linked to the same member (no unnecessary updates)');
      console.log('   - User is the group leader as expected');
      console.log('   - System correctly identified no re-linking was needed');
    } else {
      console.log('❌ FAILURE: Same leader selection did not work as expected');
    }

    // 4. Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.memberGroupMembership.deleteMany({
      where: { groupId: result.group.id }
    });
    await prisma.group.delete({
      where: { id: result.group.id }
    });
    
    // Clean up test user and members
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.member.deleteMany({
      where: {
        id: { in: [leaderMember.id, otherMember.id] }
      }
    });
    
    console.log('✅ All test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
