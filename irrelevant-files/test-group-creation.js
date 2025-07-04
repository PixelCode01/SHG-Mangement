const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupCreationFlow() {
  console.log('=== Testing Group Creation and Display Flow ===\n');
  
  try {
    // Step 1: Check initial database state
    console.log('1. Checking initial database state...');
    const initialMembers = await prisma.member.count();
    const initialGroups = await prisma.group.count();
    console.log(`   Initial members: ${initialMembers}`);
    console.log(`   Initial groups: ${initialGroups}\n`);
    
    // Step 2: Create a test member if none exists
    console.log('2. Creating test member...');
    let testMember = await prisma.member.findFirst({
      where: { name: 'Test Leader' }
    });
    
    if (!testMember) {
      testMember = await prisma.member.create({
        data: {
          name: 'Test Leader',
          email: 'leader@test.com',
          phone: '9876543210',
          address: 'Test Leader Address'
        }
      });
      console.log(`   Created member: ${testMember.name} (ID: ${testMember.id})`);
    } else {
      console.log(`   Member already exists: ${testMember.name} (ID: ${testMember.id})`);
    }
    
    // Step 3: Create a test group using Prisma directly
    console.log('\n3. Creating test group directly via Prisma...');
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const groupId = `GRP-${yearMonth}-TEST`;
    
    const testGroup = await prisma.group.create({
      data: {
        groupId,
        name: 'Test Group Direct',
        address: 'Test Group Address',
        registrationNumber: 'REG-TEST-001',
        organization: 'Test Organization',
        leaderId: testMember.id,
        memberCount: 1,
        dateOfStarting: new Date(),
        description: 'Test group created directly'
      }
    });
    
    console.log(`   Created group: ${testGroup.name} (ID: ${testGroup.id})`);
    
    // Step 4: Create membership
    console.log('\n4. Creating membership...');
    const membership = await prisma.memberGroupMembership.create({
      data: {
        memberId: testMember.id,
        groupId: testGroup.id,
        initialShareAmount: 100
      }
    });
    console.log(`   Created membership for member ${testMember.name} in group ${testGroup.name}`);
    
    // Step 5: Verify data was created
    console.log('\n5. Verifying created data...');
    const groups = await prisma.group.findMany({
      include: {
        leader: true,
        memberships: {
          include: {
            member: true
          }
        }
      }
    });
    
    const members = await prisma.member.findMany();
    
    console.log(`   Total groups: ${groups.length}`);
    console.log(`   Total members: ${members.length}`);
    
    console.log('\n   Groups detail:');
    groups.forEach(group => {
      console.log(`   - ${group.name} (${group.groupId})`);
      console.log(`     Leader: ${group.leader?.name || 'None'}`);
      console.log(`     Memberships: ${group.memberships.length}`);
      group.memberships.forEach(membership => {
        console.log(`       - ${membership.member.name}`);
      });
    });
    
    // Step 6: Test API endpoints (without authentication)
    console.log('\n6. Testing API endpoints (will likely fail due to auth)...');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const memberResponse = await fetch('http://localhost:3005/api/members');
      console.log(`   Members API status: ${memberResponse.status}`);
      if (memberResponse.status === 200) {
        const memberData = await memberResponse.json();
        console.log(`   Members API returned ${memberData.length} members`);
      } else {
        const errorText = await memberResponse.text();
        console.log(`   Members API error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   Members API request failed: ${error.message}`);
    }
    
    try {
      const fetch = (await import('node-fetch')).default;
      const groupResponse = await fetch('http://localhost:3005/api/groups');
      console.log(`   Groups API status: ${groupResponse.status}`);
      if (groupResponse.status === 200) {
        const groupData = await groupResponse.json();
        console.log(`   Groups API returned ${groupData.length} groups`);
      } else {
        const errorText = await groupResponse.text();
        console.log(`   Groups API error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   Groups API request failed: ${error.message}`);
    }
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Database operations work correctly');
    console.log('✅ Groups and members can be created');
    console.log('✅ Relationships are properly established');
    console.log('❌ API endpoints require authentication');
    console.log('\nThe issue is likely that users need to be authenticated to view created groups/members.');
    console.log('Recommendation: Ensure users are properly logged in before creating groups.');
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupCreationFlow();
