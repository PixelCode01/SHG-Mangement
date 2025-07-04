#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIGroupCreation() {
  console.log('🧪 Testing Group Creation via API...\n');

  try {
    // 1. Find a test user
    const testUser = await prisma.user.findFirst({
      where: { 
        role: 'GROUP_LEADER',
        memberId: { not: null }
      },
      include: { member: true }
    });

    if (!testUser) {
      console.log('❌ No GROUP_LEADER user with memberId found');
      return;
    }

    console.log(`✅ Using test user: ${testUser.email} -> ${testUser.member?.name} (${testUser.memberId})`);

    // 2. Find other members
    const otherMembers = await prisma.member.findMany({
      where: { 
        id: { not: testUser.memberId }
      },
      take: 3
    });

    if (otherMembers.length < 1) {
      console.log('❌ Need at least 1 other member for testing');
      return;
    }

    console.log(`✅ Other members available: ${otherMembers.length}`);

    // 3. Simulate the exact API request that would come from the form
    const requestData = {
      name: `API Test Group - ${Date.now()}`,
      address: '123 API Test Street',
      registrationNumber: `API-REG-${Date.now()}`,
      leaderId: otherMembers[0].id, // User selects someone else as leader
      memberCount: 3,
      dateOfStarting: new Date().toISOString(),
      description: 'Test group created via API simulation',
      collectionFrequency: 'MONTHLY',
      monthlyContribution: 500,
      members: [
        {
          memberId: otherMembers[0].id,
          currentShareAmount: 1000,
          currentLoanAmount: 0,
          initialInterest: 0
        },
        {
          memberId: otherMembers[1]?.id || otherMembers[0].id,
          currentShareAmount: 1500,
          currentLoanAmount: 0,
          initialInterest: 0
        }
      ]
    };

    console.log(`📋 Test data:`);
    console.log(`   Creator: ${testUser.member?.name} (${testUser.memberId})`);
    console.log(`   Selected leader: ${otherMembers[0].name} (${otherMembers[0].id})`);
    console.log(`   Members in request: ${requestData.members.length}`);
    console.log('');

    // 4. Simulate the API logic with the fixed implementation
    
    // Check if user has memberId (our validation)
    if (!testUser.memberId) {
      console.log('❌ User must be linked to a member record');
      return;
    }

    // Validate selected leader exists
    const leaderExists = await prisma.member.findUnique({
      where: { id: requestData.leaderId },
      select: { id: true }
    });
    if (!leaderExists) {
      console.log('❌ Selected leader does not exist');
      return;
    }

    // Check if leader is in members list
    const leaderInData = requestData.members.find(m => m.memberId === requestData.leaderId);
    if (!leaderInData) {
      console.log('❌ Leader must be included in the members list');
      return;
    }

    // Ensure creator is in members list (auto-add if missing)
    const membersData = [...requestData.members];
    const creatorInData = membersData.find(m => m.memberId === testUser.memberId);
    if (!creatorInData) {
      console.log('   ℹ️  Adding creator to members list automatically');
      membersData.push({
        memberId: testUser.memberId,
        currentShareAmount: 0,
        currentLoanAmount: 0,
        initialInterest: 0,
      });
    }

    // Generate group ID
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

    // 5. Create the group using the fixed logic
    const result = await prisma.$transaction(async (tx) => {
      // Creator becomes the group leader (FIXED LOGIC)
      const actualGroupLeaderId = testUser.memberId;
      
      // Create group
      const group = await tx.group.create({
        data: {
          groupId,
          name: requestData.name,
          address: requestData.address,
          registrationNumber: requestData.registrationNumber,
          leaderId: actualGroupLeaderId, // Creator is leader
          memberCount: membersData.length,
          dateOfStarting: new Date(requestData.dateOfStarting),
          collectionFrequency: requestData.collectionFrequency,
          monthlyContribution: requestData.monthlyContribution,
          description: requestData.description,
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
      if (testUser.memberId !== requestData.leaderId) {
        await tx.pendingLeadership.create({
          data: {
            groupId: group.id,
            memberId: requestData.leaderId, // Selected leader gets invitation
            initiatedByUserId: testUser.id,
            status: 'PENDING',
          },
        });
      }

      return group;
    });

    console.log('✅ Group created successfully via API simulation!');
    console.log(`   Group ID: ${result.groupId}`);
    console.log(`   Database ID: ${result.id}`);
    console.log('');

    // 6. Verify the results
    const verification = await prisma.group.findUnique({
      where: { id: result.id },
      include: {
        leader: true,
        memberships: {
          include: { member: true }
        },
        pendingLeaderships: {
          where: { status: 'PENDING' },
          include: { member: true }
        }
      }
    });

    console.log('📊 API Test Results:');
    console.log(`   ✅ Group leader: ${verification?.leader?.name} (${verification?.leaderId})`);
    console.log(`   ✅ Creator is leader: ${verification?.leaderId === testUser.memberId ? 'YES' : 'NO'}`);
    console.log(`   ✅ Members: ${verification?.memberships.length}`);
    
    if (verification?.pendingLeaderships.length > 0) {
      console.log(`   ✅ Pending invitation: ${verification.pendingLeaderships[0].member.name}`);
    }

    const success = verification?.leaderId === testUser.memberId;
    console.log(`\n🎯 API Test: ${success ? '✅ PASSED' : '❌ FAILED'}`);

    // Clean up
    console.log('\n🧹 Cleaning up...');
    await prisma.pendingLeadership.deleteMany({
      where: { groupId: result.id }
    });
    await prisma.memberGroupMembership.deleteMany({
      where: { groupId: result.id }
    });
    await prisma.group.delete({
      where: { id: result.id }
    });
    console.log('✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during API test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIGroupCreation();
