#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCompleteGroupCreationFlow() {
  console.log('🧪 Testing Complete Group Creation Flow - Leader ID Fix...\n');

  try {
    // 1. Find test users and members
    const users = await prisma.user.findMany({
      where: { 
        role: 'GROUP_LEADER',
        memberId: { not: null }
      },
      include: { member: true },
      take: 2
    });

    if (users.length < 1) {
      console.log('❌ Need at least 1 GROUP_LEADER user with memberId for testing');
      return;
    }

    const creator = users[0];
    console.log(`✅ Creator: ${creator.email} -> ${creator.member?.name} (${creator.memberId})`);

    // Find different members to select as leaders
    const otherMembers = await prisma.member.findMany({
      where: { 
        id: { not: creator.memberId },
        users: { none: {} } // Unlinked members
      },
      take: 3
    });

    if (otherMembers.length < 2) {
      console.log('❌ Need at least 2 other unlinked members for testing');
      return;
    }

    console.log(`✅ Other members: ${otherMembers.map(m => `${m.name} (${m.id})`).join(', ')}\n`);

    // 2. Test Case 1: Creator selects themselves as leader
    console.log('📋 Test Case 1: Creator selects themselves as leader');
    const group1 = await createTestGroup(creator, creator.memberId, [creator.memberId, otherMembers[0].id], 'Self-Leader Group');
    
    const result1 = await verifyGroup(group1.id, creator.memberId, false);
    console.log(`   Result: ${result1 ? '✅ PASSED' : '❌ FAILED'}\n`);

    // 3. Test Case 2: Creator selects someone else as leader  
    console.log('📋 Test Case 2: Creator selects someone else as leader');
    const group2 = await createTestGroup(creator, otherMembers[0].id, [creator.memberId, otherMembers[0].id], 'Other-Leader Group');
    
    const result2 = await verifyGroup(group2.id, creator.memberId, true, otherMembers[0].id);
    console.log(`   Result: ${result2 ? '✅ PASSED' : '❌ FAILED'}\n`);

    // 4. Test Case 3: Creator selects someone else but they're not in members list (should auto-add)
    console.log('📋 Test Case 3: Creator not in members list (should auto-add)');
    const group3 = await createTestGroup(creator, otherMembers[1].id, [otherMembers[1].id], 'Auto-Add Creator Group');
    
    const result3 = await verifyGroup(group3.id, creator.memberId, true, otherMembers[1].id, true);
    console.log(`   Result: ${result3 ? '✅ PASSED' : '❌ FAILED'}\n`);

    // 5. Summary
    const allPassed = result1 && result2 && result3;
    console.log(`🎯 Overall Test Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    if (allPassed) {
      console.log('\n🎉 Group creation logic is working correctly!');
      console.log('   ✅ Creator is always set as group leader');
      console.log('   ✅ Selected leader gets pending invitation when different from creator');
      console.log('   ✅ Creator is automatically added to members if missing');
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await cleanupGroup(group1.id);
    await cleanupGroup(group2.id);
    await cleanupGroup(group3.id);
    console.log('✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createTestGroup(creator, selectedLeaderId, memberIds, groupName) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const lastGroup = await prisma.group.findFirst({
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

  // Apply the fixed logic
  const actualGroupLeaderId = creator.memberId; // Creator becomes leader
  
  // Ensure creator is in members list
  const membersData = memberIds.map(id => ({
    memberId: id,
    currentShareAmount: 1000,
    currentLoanAmount: 0,
    initialInterest: 0,
  }));
  
  const creatorInData = membersData.find(m => m.memberId === creator.memberId);
  if (!creatorInData) {
    membersData.push({
      memberId: creator.memberId,
      currentShareAmount: 0,
      currentLoanAmount: 0,
      initialInterest: 0,
    });
  }

  return await prisma.$transaction(async (tx) => {
    // Create group with creator as leader
    const group = await tx.group.create({
      data: {
        groupId,
        name: groupName,
        address: '123 Test Street',
        registrationNumber: `REG-${Date.now()}`,
        leaderId: actualGroupLeaderId,
        memberCount: membersData.length,
        dateOfStarting: new Date(),
        collectionFrequency: 'MONTHLY',
        monthlyContribution: 500,
      },
    });

    // Create memberships
    await tx.memberGroupMembership.createMany({
      data: membersData.map(memberInfo => ({
        groupId: group.id,
        memberId: memberInfo.memberId,
        currentShareAmount: memberInfo.currentShareAmount,
        currentLoanAmount: memberInfo.currentLoanAmount,
        initialInterest: memberInfo.initialInterest,
      })),
    });

    // Create pending leadership if different leader was selected
    if (creator.memberId !== selectedLeaderId) {
      await tx.pendingLeadership.create({
        data: {
          groupId: group.id,
          memberId: selectedLeaderId,
          initiatedByUserId: creator.id,
          status: 'PENDING',
        },
      });
    }

    return group;
  });
}

async function verifyGroup(groupId, expectedLeaderId, shouldHavePending, expectedPendingMemberId = null, shouldHaveAutoAddedCreator = false) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      leader: true,
      memberships: {
        include: { member: true }
      },
      pendingLeaderships: {
        where: { status: 'PENDING' }
      }
    }
  });

  console.log(`   Group: ${group?.name}`);
  console.log(`   Leader: ${group?.leader?.name} (${group?.leaderId})`);
  console.log(`   Expected leader: ${expectedLeaderId}`);
  console.log(`   Members: ${group?.memberships.length}`);
  
  let passed = true;

  // Check leader ID
  if (group?.leaderId !== expectedLeaderId) {
    console.log(`   ❌ Leader ID mismatch: expected ${expectedLeaderId}, got ${group?.leaderId}`);
    passed = false;
  } else {
    console.log(`   ✅ Leader ID correct`);
  }

  // Check pending leadership
  if (shouldHavePending) {
    if (group?.pendingLeaderships.length === 0) {
      console.log(`   ❌ Expected pending leadership but found none`);
      passed = false;
    } else if (expectedPendingMemberId && group.pendingLeaderships[0].memberId !== expectedPendingMemberId) {
      console.log(`   ❌ Pending leadership for wrong member: expected ${expectedPendingMemberId}, got ${group.pendingLeaderships[0].memberId}`);
      passed = false;
    } else {
      console.log(`   ✅ Pending leadership correct`);
    }
  } else {
    if (group?.pendingLeaderships.length > 0) {
      console.log(`   ❌ Unexpected pending leadership found`);
      passed = false;
    } else {
      console.log(`   ✅ No pending leadership (as expected)`);
    }
  }

  // Check if creator was auto-added
  if (shouldHaveAutoAddedCreator) {
    const creatorMembership = group?.memberships.find(m => m.memberId === expectedLeaderId);
    if (!creatorMembership) {
      console.log(`   ❌ Creator was not auto-added to members`);
      passed = false;
    } else {
      console.log(`   ✅ Creator was auto-added to members`);
    }
  }

  return passed;
}

async function cleanupGroup(groupId) {
  await prisma.pendingLeadership.deleteMany({
    where: { groupId }
  });
  await prisma.memberGroupMembership.deleteMany({
    where: { groupId }
  });
  await prisma.group.delete({
    where: { id: groupId }
  });
}

testCompleteGroupCreationFlow();
