/**
 * Set up a fresh pending leadership invitation for web interface testing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupFreshInvitation() {
  try {
    console.log('🔧 Setting up fresh invitation for web interface testing...\n');

    // 1. Reset the member user role back to MEMBER
    const memberUser = await prisma.user.findUnique({
      where: { email: 'member@example.com' },
      include: { member: true }
    });
    
    if (!memberUser || !memberUser.member) {
      console.log('❌ Member user not found.');
      return;
    }

    // Reset user role to MEMBER for testing
    await prisma.user.update({
      where: { id: memberUser.id },
      data: { role: 'MEMBER' }
    });

    // 2. Find or create a group for the invitation
    let testGroup = await prisma.group.findFirst({
      where: {
        leaderId: { not: memberUser.member.id }
      },
      include: { leader: true }
    });

    if (!testGroup) {
      console.log('Creating test group...');
      
      // Create another member to be the initial leader
      const initialLeader = await prisma.member.create({
        data: {
          name: 'Initial Leader for Testing',
          fatherName: 'Father Name',
          village: 'Test Village',
          mobile: '9999999999',
          adharNumber: '999999999999',
          userId: null
        }
      });
      
      testGroup = await prisma.group.create({
        data: {
          groupId: 'TEST-WEB-001',
          name: 'Test Group for Web Interface',
          address: 'Test Address',
          registrationNumber: 'WEB001',
          organization: 'Test Organization',
          leaderId: initialLeader.id,
          memberCount: 1,
          dateOfStarting: new Date(),
          description: 'Test group for web interface verification'
        }
      });
      
      // Add the initial leader as a member
      await prisma.memberGroupMembership.create({
        data: {
          memberId: initialLeader.id,
          groupId: testGroup.id,
          initialShareAmount: 1000,
          initialLoanAmount: 0,
          initialInterest: 0
        }
      });
    }

    // 3. Clean up any existing pending invitations for this user
    await prisma.pendingLeadership.deleteMany({
      where: {
        memberId: memberUser.member.id,
        status: 'PENDING'
      }
    });

    // 4. Create a fresh pending invitation
    const pendingInvitation = await prisma.pendingLeadership.create({
      data: {
        groupId: testGroup.id,
        memberId: memberUser.member.id,
        status: 'PENDING'
      }
    });

    console.log('✅ Fresh invitation setup complete!');
    console.log('=================================');
    console.log(`User: ${memberUser.email}`);
    console.log(`Role: MEMBER (reset for testing)`);
    console.log(`Group: "${testGroup.name}"`);
    console.log(`Current Leader: ${testGroup.leader?.name}`);
    console.log(`Invitation ID: ${pendingInvitation.id}`);
    console.log('');
    console.log('🌐 Now you can test in the web interface:');
    console.log('1. Go to http://localhost:3001/login');
    console.log('2. Login with: member@example.com / password123');
    console.log('3. Navigate to /groups to see the pending invitation');
    console.log('4. Click "Accept & Become Leader"');
    console.log('5. Verify that the UI immediately shows GROUP_LEADER role');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error setting up invitation:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

setupFreshInvitation();
