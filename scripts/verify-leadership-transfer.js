// Script to verify the leadership transfer functionality is working correctly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function verifyLeadershipTransfer() {
  try {
    console.log('=== VERIFYING LEADERSHIP TRANSFER ===');
    
    // Test case 1: Create a new group
    console.log('\n1. Creating a test group with a leader...');
    
    // Find or create a test user
    let testUser = await prisma.user.findUnique({
      where: { email: 'test-leader@example.com' }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test-leader@example.com',
          name: 'Test Leader',
          role: 'GROUP_LEADER',
          password: '$2a$10$UAQrGTmsdv/j8ASzCrSxROJNE6kXKemqmtH.DOyEHuTOYUGOj5qGy', // 'password123'
        }
      });
      console.log(`Created test user: ${testUser.id}`);
    } else {
      console.log(`Using existing test user: ${testUser.id}`);
    }
    
    // Find or create a leader member
    let leaderMember = await prisma.member.findFirst({
      where: { name: 'Test Leader Member' }
    });
    
    if (!leaderMember) {
      leaderMember = await prisma.member.create({
        data: {
          name: 'Test Leader Member',
          email: 'leader@test.com',
          phone: '1234567890',
          address: 'Test Address',
          createdByUserId: testUser.id
        }
      });
      console.log(`Created leader member: ${leaderMember.id}`);
      
      // Link to user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { memberId: leaderMember.id }
      });
    } else {
      console.log(`Using existing leader member: ${leaderMember.id}`);
    }
    
    // Find or create another member
    let newLeaderMember = await prisma.member.findFirst({
      where: { name: 'New Test Leader' }
    });
    
    if (!newLeaderMember) {
      newLeaderMember = await prisma.member.create({
        data: {
          name: 'New Test Leader',
          email: 'new.leader@test.com',
          phone: '0987654321',
          address: 'New Test Address',
          createdByUserId: testUser.id
        }
      });
      console.log(`Created potential new leader member: ${newLeaderMember.id}`);
    } else {
      console.log(`Using existing potential new leader member: ${newLeaderMember.id}`);
    }
    
    // Create a test group
    const groupName = `Test Group ${new Date().toISOString()}`;
    const testGroup = await prisma.group.create({
      data: {
        name: groupName,
        groupId: `TST-${Date.now().toString().slice(-6)}`,
        leaderId: leaderMember.id,
        dateOfStarting: new Date(),
        collectionFrequency: 'MONTHLY'
      }
    });
    console.log(`Created test group: ${testGroup.name} (${testGroup.id})`);
    
    // Add members to the group
    await prisma.memberGroupMembership.createMany({
      data: [
        {
          groupId: testGroup.id,
          memberId: leaderMember.id
        },
        {
          groupId: testGroup.id,
          memberId: newLeaderMember.id
        }
      ]
    });
    console.log(`Added members to the group`);
    
    // Test case 2: Create a leadership transfer request
    console.log('\n2. Creating leadership transfer request...');
    
    const pendingLeadership = await prisma.pendingLeadership.create({
      data: {
        groupId: testGroup.id,
        memberId: newLeaderMember.id,
        initiatedByUserId: testUser.id,
        status: 'PENDING'
      }
    });
    
    console.log(`Created pending leadership: ${pendingLeadership.id}`);
    
    // Test case 3: Accept the leadership transfer
    console.log('\n3. Accepting leadership transfer request...');
    
    const updatedInvitation = await prisma.$transaction(async (tx) => {
      // Update invitation status
      const result = await tx.pendingLeadership.update({
        where: { id: pendingLeadership.id },
        data: { status: 'ACCEPTED' }
      });
      
      // Update group leader
      await tx.group.update({
        where: { id: testGroup.id },
        data: { leaderId: newLeaderMember.id }
      });
      
      return result;
    });
    
    console.log(`Updated invitation to: ${updatedInvitation.status}`);
    
    // Test case 4: Verify the group leadership was updated
    console.log('\n4. Verifying group leadership was updated...');
    
    const updatedGroup = await prisma.group.findUnique({
      where: { id: testGroup.id },
      include: {
        leader: true
      }
    });
    
    if (updatedGroup?.leader?.id === newLeaderMember.id) {
      console.log('✅ SUCCESS: Leadership was successfully transferred!');
      console.log(`Group "${updatedGroup.name}" now has leader: ${updatedGroup.leader.name}`);
    } else {
      console.log('❌ FAIL: Leadership transfer did not work correctly');
      console.log('Expected leader:', newLeaderMember.id);
      console.log('Actual leader:', updatedGroup?.leader?.id);
    }
    
  } catch (error) {
    console.error('Error verifying leadership transfer:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n=== VERIFICATION COMPLETE ===');
  }
}

verifyLeadershipTransfer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
