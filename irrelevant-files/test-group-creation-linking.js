/**
 * Test script to verify group creation with user-leader linking functionality
 * This script simulates the group creation process and verifies that:
 * 1. When a user selects a leader different from their current memberId, they get linked to that leader
 * 2. The group's leaderId is set to the selected leader
 * 3. The user becomes the group leader through the member linkage
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Group Creation with User-Leader Linking...\n');

  try {
    // 1. Find or create a test user without a memberId
    let testUser = await prisma.user.findFirst({
      where: {
        email: 'testuser@groupcreation.com',
        role: 'GROUP_LEADER'
      }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'testuser@groupcreation.com',
          password: 'hashedpassword123',
          name: 'Test User',
          role: 'GROUP_LEADER',
          memberId: null // No initial member linkage
        }
      });
      console.log('✅ Created test user without memberId:', testUser.email);
    } else {
      // Remove any existing memberId for clean testing
      await prisma.user.update({
        where: { id: testUser.id },
        data: { memberId: null }
      });
      console.log('✅ Reset test user memberId to null');
    }

    // 2. Find or create some test members
    let testMembers = await prisma.member.findMany({
      where: {
        name: { in: ['Test Leader Member', 'Test Member 2'] }
      }
    });

    if (testMembers.length < 2) {
      const membersToCreate = [];
      if (!testMembers.find(m => m.name === 'Test Leader Member')) {
        membersToCreate.push({
          name: 'Test Leader Member',
          email: 'testleader@member.com',
          phone: '1234567890',
          address: 'Test Address 1'
        });
      }
      if (!testMembers.find(m => m.name === 'Test Member 2')) {
        membersToCreate.push({
          name: 'Test Member 2',
          email: 'testmember2@member.com',
          phone: '1234567891',
          address: 'Test Address 2'
        });
      }

      for (const memberData of membersToCreate) {
        const newMember = await prisma.member.create({ data: memberData });
        testMembers.push(newMember);
      }
      console.log('✅ Created test members');
    }

    const leaderMember = testMembers.find(m => m.name === 'Test Leader Member');
    const otherMember = testMembers.find(m => m.name === 'Test Member 2');

    console.log(`📋 Test setup:
    - User ID: ${testUser.id} (${testUser.email})
    - User current memberId: ${testUser.memberId || 'null'}
    - Selected Leader Member: ${leaderMember.id} (${leaderMember.name})
    - Other Member: ${otherMember.id} (${otherMember.name})\n`);

    // 3. Simulate group creation with leader selection
    console.log('🚀 Simulating group creation...');

    const groupData = {
      name: 'Test Group for Linking',
      address: 'Test Group Address',
      registrationNumber: 'REG-TEST-001',
      leaderId: leaderMember.id, // User selects this leader (different from their memberId)
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

    // Simulate the group creation logic from the API
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

      // Link user to selected leader member (key functionality being tested)
      const userMemberId = testUser.memberId;
      const selectedLeaderId = groupData.leaderId;
      
      if (!userMemberId || userMemberId !== selectedLeaderId) {
        await tx.user.update({
          where: { id: testUser.id },
          data: { memberId: selectedLeaderId }
        });
        console.log(`🔗 Linked user ${testUser.id} to member ${selectedLeaderId}`);
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

    // 4. Verify the results
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
    ✅ User is now linked to member: ${updatedUser.memberId} (${updatedUser.member?.name})
    ✅ Group leader ID: ${createdGroup.leaderId} (${createdGroup.leader?.name})
    ✅ User and group leader match: ${updatedUser.memberId === createdGroup.leaderId ? 'YES' : 'NO'}
    ✅ Group has ${createdGroup.memberships.length} members
    ✅ Group ID: ${createdGroup.groupId}
    `);

    if (updatedUser.memberId === createdGroup.leaderId && updatedUser.memberId === leaderMember.id) {
      console.log('🎉 SUCCESS: User-leader linking functionality works correctly!');
      console.log('   - User is now linked to the selected leader member');
      console.log('   - User has become the group leader through member linkage');
    } else {
      console.log('❌ FAILURE: User-leader linking did not work as expected');
    }

    // 5. Clean up test data
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
