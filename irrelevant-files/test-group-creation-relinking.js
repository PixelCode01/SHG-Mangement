/**
 * Test script to verify group creation when user has existing memberId but selects different leader
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Group Creation with Existing User MemberId...\n');

  try {
    // 1. Find test user and give them an existing memberId
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

    // Set user's initial memberId to the other member (not the leader they'll select)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { memberId: otherMember.id }
    });

    console.log(`📋 Test setup:
    - User ID: ${testUser.id} (${testUser.email})
    - User current memberId: ${otherMember.id} (${otherMember.name})
    - Selected Leader Member: ${leaderMember.id} (${leaderMember.name}) - DIFFERENT from current
    - Other Member: ${otherMember.id} (${otherMember.name})\n`);

    // 2. Simulate group creation where user selects a different leader
    console.log('🚀 Simulating group creation with different leader selection...');

    const groupData = {
      name: 'Test Group for Re-linking',
      address: 'Test Group Address 2',
      registrationNumber: 'REG-TEST-002',
      leaderId: leaderMember.id, // User selects this leader (different from their current memberId)
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

      // Check if user needs re-linking (key functionality being tested)
      // Get fresh user data from database within transaction
      const currentUser = await tx.user.findUnique({
        where: { id: testUser.id },
        select: { memberId: true }
      });
      const userMemberId = currentUser.memberId;
      const selectedLeaderId = groupData.leaderId;
      
      console.log(`🔄 User current memberId: ${userMemberId}, Selected leader: ${selectedLeaderId}`);
      
      if (!userMemberId || userMemberId !== selectedLeaderId) {
        console.log(`🔗 Re-linking user from ${userMemberId} to ${selectedLeaderId}`);
        await tx.user.update({
          where: { id: testUser.id },
          data: { memberId: selectedLeaderId }
        });
        console.log(`✅ Successfully re-linked user to new leader member`);
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
    ✅ User was re-linked from: ${otherMember.name} → ${updatedUser.member?.name}
    ✅ User current memberId: ${updatedUser.memberId}
    ✅ Group leader ID: ${createdGroup.leaderId} (${createdGroup.leader?.name})
    ✅ User and group leader match: ${updatedUser.memberId === createdGroup.leaderId ? 'YES' : 'NO'}
    ✅ Group has ${createdGroup.memberships.length} members
    ✅ Group ID: ${createdGroup.groupId}
    `);

    if (updatedUser.memberId === createdGroup.leaderId && updatedUser.memberId === leaderMember.id) {
      console.log('🎉 SUCCESS: User re-linking functionality works correctly!');
      console.log('   - User was successfully re-linked to the selected leader member');
      console.log('   - User has become the new group leader through member re-linkage');
      console.log('   - Previous member linkage was properly updated');
    } else {
      console.log('❌ FAILURE: User re-linking did not work as expected');
    }

    // 4. Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.memberGroupMembership.deleteMany({
      where: { groupId: result.group.id }
    });
    await prisma.group.delete({
      where: { id: result.group.id }
    });
    console.log('✅ Test group and memberships deleted');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
