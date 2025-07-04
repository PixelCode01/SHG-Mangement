#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSimpleTestData() {
  try {
    console.log('Creating simple test data for late fine testing...\n');

    // First, check if we have any user for authentication
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users in the database`);

    if (users.length === 0) {
      console.log('No users found. Creating a test user...');
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          role: 'GROUP_LEADER'
        }
      });
      console.log(`Created test user: ${testUser.email}`);
    }

    // Create test members
    console.log('Creating test members...');
    
    // Clean up any existing test data first
    await prisma.lateFineRule.deleteMany({ where: { group: { name: 'Test Group for Late Fines' } } });
    await prisma.memberGroupMembership.deleteMany({ where: { group: { name: 'Test Group for Late Fines' } } });
    await prisma.group.deleteMany({ where: { name: 'Test Group for Late Fines' } });
    
    const memberNames = ['ACHAL KUMAR OJHA', 'RITA DEVI', 'SUNITA KUMARI'];
    const createdMembers = [];
    
    for (const name of memberNames) {
      // Check if member already exists
      let member = await prisma.member.findFirst({ where: { name } });
      
      if (!member) {
        member = await prisma.member.create({
          data: {
            name: name,
            email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            phone: `9${Math.floor(Math.random() * 1000000000)}`
          }
        });
        console.log(`Created member: ${member.name}`);
      } else {
        console.log(`Using existing member: ${member.name}`);
      }
      
      createdMembers.push(member);
    }

    // Create test group
    console.log('Creating test group...');
    const group = await prisma.group.create({
      data: {
        groupId: `GRP-TEST-${Date.now()}`,
        name: 'Test Group for Late Fines',
        address: 'Test Village',
        leaderId: createdMembers[0].id,
        memberCount: createdMembers.length,
        monthlyContribution: 500,
        interestRate: 12,
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15,
        dateOfStarting: new Date('2024-01-01'),
        description: 'Test group to demonstrate late fine functionality'
      }
    });
    console.log(`Created group: ${group.name} (ID: ${group.id})`);

    // Create late fine rule
    console.log('Creating late fine rule...');
    const lateFineRule = await prisma.lateFineRule.create({
      data: {
        groupId: group.id,
        ruleType: 'DAILY_FIXED',
        isEnabled: true,
        dailyAmount: 10 // ₹10 per day late
      }
    });
    console.log(`Created late fine rule: ₹${lateFineRule.dailyAmount} per day`);

    // Create memberships
    console.log('Creating memberships...');
    for (let i = 0; i < createdMembers.length; i++) {
      await prisma.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: createdMembers[i].id,
          currentLoanAmount: (i + 1) * 10000 // Different loan amounts
        }
      });
      console.log(`Added ${createdMembers[i].name} to group`);
    }

    console.log('\n✅ Test data created successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Group: ${group.name}`);
    console.log(`- Group ID: ${group.id}`);
    console.log(`- Members: ${createdMembers.length}`);
    console.log(`- Late Fine Rule: ₹${lateFineRule.dailyAmount}/day (${lateFineRule.isEnabled ? 'Enabled' : 'Disabled'})`);
    console.log('\n🌐 Now you can:');
    console.log('1. Start the development server: npm run dev');
    console.log(`2. Navigate to: http://localhost:3000/groups/${group.id}/contributions`);
    console.log('3. You should see the Late Fine column in the contributions table');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSimpleTestData();
