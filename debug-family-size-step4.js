// Debug family size storage issue in step 4 of group creation
const { PrismaClient } = require('@prisma/client');

async function testFamilySizeDebug() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Testing family size storage in group creation...');

    // Simulate the exact data structure that gets sent from MultiStepGroupForm
    const testGroupData = {
      name: 'Test Group - Family Size Debug',
      organization: 'TEST',
      leaderId: null, // Will be set after member creation
      collectionFrequency: 'MONTHLY',
      members: []
    };

    console.log('\n1️⃣  Creating test members first...');
    
    // Create test members
    const member1 = await prisma.member.create({
      data: {
        name: 'Test Member 1',
        fatherOrHusbandName: 'Father 1',
        address: 'Test Address 1',
        mobileNumber: '1234567890',
        aadharNumber: '111111111111'
      }
    });

    const member2 = await prisma.member.create({
      data: {
        name: 'Test Member 2', 
        fatherOrHusbandName: 'Father 2',
        address: 'Test Address 2',
        mobileNumber: '2345678901',
        aadharNumber: '222222222222'
      }
    });

    console.log(`✅ Created members: ${member1.id}, ${member2.id}`);

    // Update test data with real member IDs
    testGroupData.leaderId = member1.id;
    testGroupData.members = [
      {
        memberId: member1.id,
        currentShare: 100,
        currentLoanAmount: 0,
        familyMembersCount: 5 // Test family size
      },
      {
        memberId: member2.id,
        currentShare: 100, 
        currentLoanAmount: 0,
        familyMembersCount: 3 // Test family size
      }
    ];

    console.log('\n2️⃣  Creating group with family size data...');
    console.log('Members data:', JSON.stringify(testGroupData.members, null, 2));

    // Create the group (simulate the transaction from the API)
    const result = await prisma.$transaction(async (tx) => {
      // Create the group
      const group = await tx.group.create({
        data: {
          name: testGroupData.name,
          organization: testGroupData.organization,
          leaderId: testGroupData.leaderId,
          collectionFrequency: testGroupData.collectionFrequency,
          memberCount: testGroupData.members.length,
          cashInHand: 0,
          balanceInBank: 0
        }
      });

      console.log(`✅ Created group: ${group.id}`);

      // Create memberships
      if (testGroupData.members.length > 0) {
        await tx.memberGroupMembership.createMany({
          data: testGroupData.members.map(memberInfo => ({
            groupId: group.id,
            memberId: memberInfo.memberId,
            currentShareAmount: memberInfo.currentShare,
            currentLoanAmount: memberInfo.currentLoanAmount,
          }))
        });

        console.log('✅ Created memberships');

        // Update family members count - THIS IS THE KEY PART
        console.log('\n3️⃣  Updating family sizes...');
        for (const memberInfo of testGroupData.members) {
          if (memberInfo.familyMembersCount !== undefined) {
            const updateResult = await tx.member.update({
              where: { id: memberInfo.memberId },
              data: { familyMembersCount: memberInfo.familyMembersCount }
            });
            console.log(`✅ Updated member ${memberInfo.memberId} family size to ${memberInfo.familyMembersCount} (result: ${updateResult.familyMembersCount})`);
          } else {
            console.log(`⏭️  Skipped member ${memberInfo.memberId} - no family size data`);
          }
        }
      }

      return group;
    });

    console.log('\n4️⃣  Verifying family sizes were saved...');
    
    // Verify the family sizes were saved
    const member1Check = await prisma.member.findUnique({
      where: { id: member1.id },
      select: { id: true, name: true, familyMembersCount: true }
    });

    const member2Check = await prisma.member.findUnique({
      where: { id: member2.id },
      select: { id: true, name: true, familyMembersCount: true }
    });

    console.log('Member 1 after update:', member1Check);
    console.log('Member 2 after update:', member2Check);

    // Check if members show up correctly in group retrieval
    console.log('\n5️⃣  Testing group retrieval with family sizes...');
    const groupWithMembers = await prisma.group.findUnique({
      where: { id: result.id },
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                familyMembersCount: true
              }
            }
          }
        }
      }
    });

    console.log('Group with members:');
    groupWithMembers.memberships.forEach((membership, index) => {
      console.log(`  Member ${index + 1}: ${membership.member.name}, Family Size: ${membership.member.familyMembersCount}`);
    });

    // Clean up test data
    console.log('\n6️⃣  Cleaning up test data...');
    await prisma.memberGroupMembership.deleteMany({ where: { groupId: result.id } });
    await prisma.group.delete({ where: { id: result.id } });
    await prisma.member.deleteMany({ where: { id: { in: [member1.id, member2.id] } } });
    console.log('✅ Cleaned up test data');

    console.log('\n✅ Family size debug test completed successfully!');
    
    if (member1Check.familyMembersCount === 5 && member2Check.familyMembersCount === 3) {
      console.log('🎉 FAMILY SIZES SAVED CORRECTLY!');
    } else {
      console.log('❌ FAMILY SIZES NOT SAVED CORRECTLY!');
      console.log(`Expected: Member1=5, Member2=3`);
      console.log(`Actual: Member1=${member1Check.familyMembersCount}, Member2=${member2Check.familyMembersCount}`);
    }

  } catch (error) {
    console.error('❌ Debug test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFamilySizeDebug();
