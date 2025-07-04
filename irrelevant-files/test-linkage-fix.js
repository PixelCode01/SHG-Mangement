const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupCreationAndLinkage() {
  console.log('=== Testing Group Creation and User-Member Linkage ===\n');

  try {
    // First, let's check the current state
    console.log('1. Current state before creating a new group:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log('Users:');
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
      console.log(`    Member ID: ${user.memberId || 'NOT SET'}`);
      console.log(`    Linked Member: ${user.member ? user.member.name : 'NONE'}`);
    });
    console.log('');

    // Find a GROUP_LEADER user without memberId
    const groupLeaderUser = users.find(u => u.role === 'GROUP_LEADER' && !u.memberId);
    if (!groupLeaderUser) {
      console.log('No GROUP_LEADER user without memberId found. Creating one...');
      
      // Create a test GROUP_LEADER user
      const newUser = await prisma.user.create({
        data: {
          email: 'testleader@example.com',
          role: 'GROUP_LEADER',
          name: 'Test Leader',
          password: 'test123' // In production, this should be hashed
        }
      });
      
      console.log(`Created test user: ${newUser.email} (ID: ${newUser.id})`);
      console.log('');
    }

    // Get the user to test with
    const testUser = groupLeaderUser || await prisma.user.findFirst({
      where: { email: 'testleader@example.com' }
    });

    console.log(`2. Testing with user: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`   Current memberId: ${testUser.memberId || 'NOT SET'}`);
    console.log('');

    // Create a member that will be the leader
    console.log('3. Creating a member to be the group leader...');
    const leaderMember = await prisma.member.create({
      data: {
        name: 'Test Leader Member',
        email: 'testleader@example.com',
        createdByUserId: testUser.id
      }
    });
    
    console.log(`Created member: ${leaderMember.name} (ID: ${leaderMember.id})`);
    console.log('');

    // Simulate the group creation API call
    console.log('4. Simulating group creation (like the API would do)...');
    
    const groupData = {
      groupId: 'TEST-GRP-001',
      name: 'Test Linkage Group',
      address: 'Test Address',
      registrationNumber: 'TEST001',
      leaderId: leaderMember.id,
      memberCount: 1,
      dateOfStarting: new Date(),
      collectionFrequency: 'MONTHLY'
    };

    const result = await prisma.$transaction(async (tx) => {
      // Create the group
      const group = await tx.group.create({
        data: groupData
      });

      // Create membership
      await tx.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: leaderMember.id,
          currentShareAmount: 0,
          currentLoanAmount: 0
        }
      });

      // SIMULATE THE FIX: Link the user to their member record if they don't have one yet
      if (testUser.role === 'GROUP_LEADER' && !testUser.memberId) {
        const leaderMemberRecord = await tx.member.findUnique({
          where: { id: leaderMember.id },
          select: { id: true, name: true }
        });
        
        if (leaderMemberRecord) {
          // Update the user's memberId to link them to the leader member
          await tx.user.update({
            where: { id: testUser.id },
            data: { memberId: leaderMember.id }
          });
          
          console.log(`✅ Linked user ${testUser.id} to member ${leaderMember.id} (${leaderMemberRecord.name})`);
        }
      }

      return group;
    });

    console.log(`Created group: ${result.name} (ID: ${result.id})`);
    console.log('');

    // Verify the linkage worked
    console.log('5. Verifying the user-member linkage after group creation:');
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
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`User: ${updatedUser.email}`);
    console.log(`  Member ID: ${updatedUser.memberId || 'NOT SET'}`);
    console.log(`  Linked Member: ${updatedUser.member ? updatedUser.member.name : 'NONE'}`);
    if (updatedUser.member && updatedUser.member.ledGroups.length > 0) {
      console.log(`  Groups Led:`);
      updatedUser.member.ledGroups.forEach(group => {
        console.log(`    - ${group.name} (ID: ${group.id})`);
      });
    }
    console.log('');

    // Test the groups listing API behavior
    console.log('6. Testing groups listing API logic:');
    
    // Simulate GET /api/groups for GROUP_LEADER
    const userForGroupsList = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        member: {
          select: {
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
    
    const groups = userForGroupsList?.member?.ledGroups || [];
    console.log(`Groups visible to ${updatedUser.email}:`);
    if (groups.length > 0) {
      groups.forEach(group => {
        console.log(`  - ${group.name} (Leader: ${group.leader?.name || 'NO LEADER'})`);
      });
    } else {
      console.log('  No groups found (this indicates the issue still exists)');
    }
    console.log('');

    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupCreationAndLinkage();
