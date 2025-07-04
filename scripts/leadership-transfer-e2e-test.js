/**
 * End-to-End Test Script for Leadership Transfer
 * 
 * This script provides steps to test the complete leadership transfer workflow manually:
 * 1. Creates a group with a leader
 * 2. Creates another member
 * 3. Invites the second member to become the new leader
 * 4. Provides instructions to accept the invitation through the UI
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupLeadershipTransferTest() {
  console.log('Beginning test setup...');
  try {
    console.log('Setting up leadership transfer test environment...');
    
    // Step 1: Create test users and members if not already exist
    // Check if our test users exist
    let user1 = await prisma.user.findFirst({
      where: { email: 'leader@example.com' }
    });
    
    let user2 = await prisma.user.findFirst({
      where: { email: 'member@example.com' }
    });
    
    // Create users if they don't exist
    if (!user1) {
      user1 = await prisma.user.create({
        data: {
          email: 'leader@example.com',
          name: 'Original Leader',
          password: '$2a$10$UAQrGTmsdv/j8ASzCrSxROJNE6kXKemqmtH.DOyEHuTOYUGOj5qGy', // 'password123'
          role: 'GROUP_LEADER'
        }
      });
      console.log('Created test user 1 (Original Leader)');
    } else {
      console.log('Using existing user 1:', user1.email);
    }
    
    if (!user2) {
      user2 = await prisma.user.create({
        data: {
          email: 'member@example.com',
          name: 'New Leader',
          password: '$2a$10$UAQrGTmsdv/j8ASzCrSxROJNE6kXKemqmtH.DOyEHuTOYUGOj5qGy', // 'password123'
          role: 'MEMBER'
        }
      });
      console.log('Created test user 2 (New Leader)');
    } else {
      console.log('Using existing user 2:', user2.email);
    }
    
    // Step 2: Create test members if they don't exist
    let member1 = await prisma.member.findFirst({
      where: { name: 'Original Leader' }
    });
    
    let member2 = await prisma.member.findFirst({
      where: { name: 'New Leader' }
    });
    
    if (!member1) {
      member1 = await prisma.member.create({
        data: {
          name: 'Original Leader',
          address: '123 Test St',
          phone: '1234567890',
          email: 'leader@example.com',
          createdByUserId: user1.id
        }
      });
      
      // Link member to user
      await prisma.user.update({
        where: { id: user1.id },
        data: { memberId: member1.id }
      });
      
      console.log('Created test member 1:', member1.id);
    } else {
      console.log('Using existing member 1:', member1.id);
    }
    
    if (!member2) {
      member2 = await prisma.member.create({
        data: {
          name: 'New Leader',
          address: '456 Test Ave',
          phone: '0987654321',
          email: 'member@example.com',
          createdByUserId: user1.id
        }
      });
      
      // Link member to user
      await prisma.user.update({
        where: { id: user2.id },
        data: { memberId: member2.id }
      });
      
      console.log('Created test member 2:', member2.id);
    } else {
      console.log('Using existing member 2:', member2.id);
    }
    
    // Step 3: Create a test group if it doesn't exist
    let testGroup = await prisma.group.findFirst({
      where: { name: 'Leadership Test Group' }
    });
    
    if (!testGroup) {
      testGroup = await prisma.group.create({
        data: {
          name: 'Leadership Test Group',
          dateOfStarting: new Date(),
          groupId: 'TEST-LDR-001',
          leaderId: member1.id,
          collectionFrequency: 'MONTHLY'
        }
      });
      console.log('Created test group:', testGroup.id);
      
      // Add both members to the group
      await prisma.memberGroupMembership.createMany({
        data: [
          {
            groupId: testGroup.id,
            memberId: member1.id
          },
          {
            groupId: testGroup.id,
            memberId: member2.id
          }
        ]
      });
      console.log('Added both members to the group');
    } else {
      console.log('Using existing test group:', testGroup.id);
    }
    
    // Step 4: Create a pending leadership invitation
    const existingInvitation = await prisma.pendingLeadership.findFirst({
      where: {
        groupId: testGroup.id,
        memberId: member2.id,
        status: 'PENDING'
      }
    });
    
    if (!existingInvitation) {
      const invitation = await prisma.pendingLeadership.create({
        data: {
          groupId: testGroup.id,
          memberId: member2.id,
          initiatedByUserId: user1.id,
          status: 'PENDING'
        }
      });
      console.log('Created pending leadership invitation:', invitation.id);
    } else {
      console.log('Existing pending invitation found:', existingInvitation.id);
    }
    
    // Output test instructions
    console.log('\n==== LEADERSHIP TRANSFER TEST INSTRUCTIONS ====');
    console.log('Test environment is ready. Follow these steps to test:');
    console.log('\n1. Login as the new leader:');
    console.log('   - Email: member@example.com');
    console.log('   - Password: password123');
    console.log('\n2. After login, go to the home page');
    console.log('\n3. You should see a "Pending Group Leadership Invitations" section');
    console.log('\n4. Click "Accept & Become Leader" to accept the invitation');
    console.log('\n5. Verify the group page shows you as the new leader');
    
  } catch (error) {
    console.error('Error setting up leadership transfer test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupLeadershipTransferTest()
  .catch(e => {
    console.error("Top level error:", e);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script completed');
  });
