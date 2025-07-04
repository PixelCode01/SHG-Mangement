#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestDataWithLateFines() {
  try {
    console.log('🔧 Creating test data with late fine rules...\n');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.memberContribution.deleteMany();
    await prisma.memberGroupMembership.deleteMany();
    await prisma.lateFineRuleTier.deleteMany();
    await prisma.lateFineRule.deleteMany();
    await prisma.group.deleteMany();
    await prisma.member.deleteMany();

    // Create test members
    console.log('👥 Creating test members...');
    const members = [];
    
    const memberNames = [
      'ACHAL KUMAR OJHA',
      'RITA DEVI',
      'SUNITA KUMARI',
      'MANJULA DEVI',
      'ANITA KUMARI'
    ];

    for (const name of memberNames) {
      const member = await prisma.member.create({
        data: {
          name: name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          phone: `9${Math.floor(Math.random() * 1000000000)}`,
        }
      });
      members.push(member);
      console.log(`✅ Created member: ${member.name}`);
    }

    // Create a test group
    console.log('\n📊 Creating test group...');
    const group = await prisma.group.create({
      data: {
        groupId: `GRP-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-001`,
        name: 'Test SHG Group',
        address: 'Test Village, Test District',
        registrationNumber: 'TEST-SHG-001',
        organization: 'JSK',
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15, // 15th of each month
        dateOfStarting: new Date('2024-01-01'),
        leaderId: members[0].id, // First member as leader
        memberCount: members.length,
        monthlyContribution: 500,
        interestRate: 12,
        description: 'Test group with late fine rules'
      }
    });
    console.log(`✅ Created group: ${group.name}`);

    // Create late fine rule
    console.log('\n💰 Creating late fine rule...');
    const lateFineRule = await prisma.lateFineRule.create({
      data: {
        groupId: group.id,
        ruleType: 'DAILY_FIXED',
        isEnabled: true,
        dailyAmount: 10, // ₹10 per day late
      }
    });
    console.log(`✅ Created late fine rule: ${lateFineRule.ruleType} - ₹${lateFineRule.dailyAmount}/day`);

    // Create memberships
    console.log('\n👥 Creating memberships...');
    const loanAmounts = [85000, 45000, 32000, 28000, 15000];
    
    for (let i = 0; i < members.length; i++) {
      const membership = await prisma.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: members[i].id,
          currentShareAmount: 1000,
          currentLoanAmount: loanAmounts[i],
          initialInterest: 0,
        }
      });
      console.log(`✅ Created membership for ${members[i].name} with loan ₹${loanAmounts[i]}`);
    }

    // Create some overdue contributions to test late fines
    console.log('\n📝 Creating overdue contributions to test late fines...');
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 7); // 7 days overdue

    for (let i = 0; i < 3; i++) { // First 3 members have overdue contributions
      const memberContribution = await prisma.memberContribution.create({
        data: {
          memberId: members[i].id,
          groupId: group.id,
          periodStartDate: overdueDate,
          periodEndDate: new Date(overdueDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
          compulsoryContributionDue: 500,
          loanInterestDue: Math.round(loanAmounts[i] * 0.12 / 12), // Monthly interest
          compulsoryContributionPaid: i === 1 ? 300 : 0, // Rita partially paid
          loanInterestPaid: 0,
          lateFinePaid: 0,
          dueDate: overdueDate,
          status: i === 1 ? 'PARTIAL' : 'PENDING',
          daysLate: 7,
          lateFineAmount: 70, // 7 days * ₹10/day
        }
      });
      console.log(`✅ Created overdue contribution for ${members[i].name} - ₹${memberContribution.lateFineAmount} late fine`);
    }

    console.log('\n🎉 Test data created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`- Group: ${group.name}`);
    console.log(`- Members: ${members.length}`);
    console.log(`- Late Fine Rule: ₹${lateFineRule.dailyAmount}/day`);
    console.log(`- Overdue Contributions: 3 (with late fines)`);
    console.log(`\n🌐 You can now view the contributions page to see late fines in action!`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDataWithLateFines();
