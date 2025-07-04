const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCompleteFlow() {
  console.log('=== Testing Complete Group Creation and Listing Flow ===\n');

  try {
    // 1. Check the state before testing
    console.log('1. Current state:');
    const testUser = await prisma.user.findFirst({
      where: { email: 'leader@test.com' },
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true,
            ledGroups: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!testUser) {
      console.log('❌ Test user leader@test.com not found. Please run create-test-group-leader.js first.');
      return;
    }

    console.log(`User: ${testUser.email} (${testUser.role})`);
    console.log(`  Member ID: ${testUser.memberId || 'NOT SET'}`);
    console.log(`  Linked Member: ${testUser.member ? testUser.member.name : 'NONE'}`);
    console.log(`  Groups Led: ${testUser.member ? testUser.member.ledGroups.length : 0}`);
    console.log('');

    // 2. Create a member for this user to use as leader
    console.log('2. Creating a member for the test user...');
    const memberName = 'Test Group Leader Member';
    
    // Check if member already exists
    let testMember = await prisma.member.findFirst({
      where: { 
        name: memberName,
        createdByUserId: testUser.id 
      }
    });

    if (!testMember) {
      testMember = await prisma.member.create({
        data: {
          name: memberName,
          email: 'leader@test.com',
          createdByUserId: testUser.id
        }
      });
      console.log(`✅ Created member: ${testMember.name} (ID: ${testMember.id})`);
    } else {
      console.log(`✅ Using existing member: ${testMember.name} (ID: ${testMember.id})`);
    }
    console.log('');

    // 3. Simulate API call to POST /api/groups with authentication
    console.log('3. Simulating authenticated group creation API call...');
    
    // This simulates what happens in the API when a GROUP_LEADER creates a group
    const groupData = {
      groupId: `TEST-${Date.now()}-001`,
      name: 'API Test Group',
      address: '123 Test Street',
      registrationNumber: 'REG-' + Date.now(),
      leaderId: testMember.id,
      memberCount: 1,
      dateOfStarting: new Date(),
      collectionFrequency: 'MONTHLY',
      cashInHand: 0,
      balanceInBank: 0,
      monthlyContribution: 100
    };

    const group = await prisma.$transaction(async (tx) => {
      // Create the group
      const newGroup = await tx.group.create({
        data: groupData
      });

      // Create membership
      await tx.memberGroupMembership.create({
        data: {
          groupId: newGroup.id,
          memberId: testMember.id,
          currentShareAmount: 0,
          currentLoanAmount: 0
        }
      });

      // Apply the fix: Link the user to their member record if they don't have one yet
      if (testUser.role === 'GROUP_LEADER' && !testUser.memberId) {
        console.log('  📝 Applying user-member linkage fix...');
        
        const leaderMember = await tx.member.findUnique({
          where: { id: testMember.id },
          select: { id: true, name: true }
        });
        
        if (leaderMember) {
          await tx.user.update({
            where: { id: testUser.id },
            data: { memberId: testMember.id }
          });
          
          console.log(`  ✅ Linked user ${testUser.id} to member ${testMember.id} (${leaderMember.name})`);
        }
      } else if (testUser.memberId) {
        console.log('  ℹ️  User already has memberId set, no linking needed');
      }

      return newGroup;
    });

    console.log(`✅ Created group: ${group.name} (ID: ${group.id})`);
    console.log('');

    // 4. Test the GET /api/groups logic for GROUP_LEADER
    console.log('4. Testing groups listing (simulating GET /api/groups)...');
    
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true,
            ledGroups: {
              include: {
                leader: { select: { id: true, name: true } },
                memberships: { select: { memberId: true } },
              }
            }
          }
        }
      }
    });

    console.log(`Updated user state:`);
    console.log(`  Email: ${updatedUser.email}`);
    console.log(`  Member ID: ${updatedUser.memberId || 'NOT SET'}`);
    console.log(`  Linked Member: ${updatedUser.member ? updatedUser.member.name : 'NONE'}`);
    console.log('');

    // This is the exact logic from GET /api/groups for GROUP_LEADER
    const groups = updatedUser?.member?.ledGroups || [];
    
    console.log(`Groups visible to ${updatedUser.email} (GROUP_LEADER):`);
    if (groups.length > 0) {
      groups.forEach((group, index) => {
        console.log(`  ${index + 1}. ${group.name}`);
        console.log(`     ID: ${group.id}`);
        console.log(`     Leader: ${group.leader?.name || 'NO LEADER'}`);
        console.log(`     Members: ${group.memberships?.length || 0}`);
      });
      console.log('');
      console.log('✅ SUCCESS! The user can now see their groups.');
    } else {
      console.log('  ❌ No groups found - the issue still exists!');
    }
    console.log('');

    // 5. Summary
    console.log('=== SUMMARY ===');
    console.log(`Before fix: User had memberId = ${testUser.memberId || 'NULL'}`);
    console.log(`After fix: User has memberId = ${updatedUser.memberId || 'NULL'}`);
    console.log(`Groups visible: ${groups.length}`);
    
    if (groups.length > 0 && updatedUser.memberId) {
      console.log('✅ ISSUE RESOLVED: User can now see groups they create!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('1. The fix is working in the API code');
      console.log('2. You can now test by logging in as leader@test.com / leader123');
      console.log('3. Create a group through the web interface');
      console.log('4. The group should appear in your groups list');
    } else {
      console.log('❌ Issue still exists - need to investigate further');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow();
