#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createCompleteTestData() {
  try {
    console.log('🔧 Creating complete test data with proper loan amounts...\n');

    // First, create test members
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
        dateOfStarting: new Date('2024-01-01'),
        leaderId: members[0].id, // First member as leader
        memberCount: members.length,
        description: 'Test group for loan amount verification'
      }
    });
    console.log(`✅ Created group: ${group.name}`);

    // Create memberships with proper initial loan amounts
    console.log('\n💰 Creating memberships with initial loan amounts...');
    const loanAmounts = [85702, 45000, 32000, 28000, 15000]; // Different loan amounts
    
    for (let i = 0; i < members.length; i++) {
      const membership = await prisma.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: members[i].id,
          initialShareAmount: 1000, // Standard share amount
          initialLoanAmount: loanAmounts[i], // Different loan amounts
          initialInterest: 0
        }
      });
      
      console.log(`✅ Created membership for ${members[i].name} with loan amount: ₹${loanAmounts[i].toLocaleString('en-IN')}`);
    }

    // Create a periodic record
    console.log('\n📝 Creating periodic record...');
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: new Date(),
        recordSequenceNumber: 1,
        standingAtStartOfPeriod: 200000,
        totalCollectionThisPeriod: 25000,
        expensesThisPeriod: 3000,
        totalGroupStandingAtEndOfPeriod: 222000,
        cashInHandAtEndOfPeriod: 222000,
        cashInBankAtEndOfPeriod: 0,
        newContributionsThisPeriod: 25000,
        interestEarnedThisPeriod: 0,
        loanProcessingFeesCollectedThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0,
        memberRecords: {
          createMany: {
            data: members.map((member) => ({
              memberId: member.id,
              compulsoryContribution: 5000,
              loanRepaymentPrincipal: 0,
              lateFinePaid: 0,
            }))
          }
        }
      }
    });
    
    console.log(`✅ Created periodic record: ${periodicRecord.id}`);

    // Verify the data
    console.log('\n🔍 Verifying created data...');
    const verificationGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        memberships: {
          include: {
            member: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log(`\n=== Verification Results ===`);
    console.log(`Group: ${verificationGroup.name}`);
    console.log(`Memberships with loan amounts:`);
    
    for (const membership of verificationGroup.memberships) {
      console.log(`  - ${membership.member.name}: ₹${membership.initialLoanAmount?.toLocaleString('en-IN') || '0'}`);
    }

    console.log(`\n✅ Test data creation completed successfully!`);
    console.log(`📊 Group ID: ${group.id}`);
    console.log(`📝 Periodic Record ID: ${periodicRecord.id}`);
    console.log(`\nYou can now test the API with: /api/groups/${group.id}/periodic-records/${periodicRecord.id}`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCompleteTestData();
