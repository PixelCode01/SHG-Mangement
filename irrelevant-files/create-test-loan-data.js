#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestLoanData() {
  try {
    console.log('🔧 Creating test loan data...\n');

    // Get the first group and some members
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          },
          take: 3 // Get first 3 members
        }
      }
    });

    if (!group || group.memberships.length === 0) {
      console.log('❌ No group or members found');
      return;
    }

    console.log(`📊 Using group: ${group.name}`);
    console.log(`👥 Found ${group.memberships.length} members\n`);

    // Update members with initial loan amounts
    const updates = [];
    for (let i = 0; i < group.memberships.length; i++) {
      const membership = group.memberships[i];
      const initialLoanAmount = (i + 1) * 5000; // 5000, 10000, 15000

      const updatedMember = await prisma.member.update({
        where: { id: membership.member.id },
        data: { initialLoanAmount: initialLoanAmount }
      });

      updates.push({
        name: updatedMember.name,
        initialLoanAmount: initialLoanAmount
      });

      console.log(`✅ Updated ${updatedMember.name} with initial loan amount: ₹${initialLoanAmount}`);
    }

    // Create some active loans
    console.log('\n💰 Creating active loans...');
    
    for (let i = 0; i < Math.min(2, group.memberships.length); i++) {
      const membership = group.memberships[i];
      const loanAmount = (i + 1) * 3000; // 3000, 6000
      
      const loan = await prisma.loan.create({
        data: {
          groupId: group.id,
          memberId: membership.member.id,
          loanType: 'PERSONAL',
          originalAmount: loanAmount,
          currentBalance: loanAmount * 0.8, // 80% remaining
          interestRate: 0.12, // 12% annual
          dateIssued: new Date(),
          status: 'ACTIVE'
        }
      });

      console.log(`✅ Created loan for ${membership.member.name}: ₹${loanAmount} (Balance: ₹${loan.currentBalance})`);
    }

    // Create a test periodic record
    console.log('\n📝 Creating test periodic record...');
    
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: new Date(),
        recordSequenceNumber: 1,
        standingAtStartOfPeriod: 50000,
        totalCollectionThisPeriod: 15000,
        expensesThisPeriod: 2000,
        totalGroupStandingAtEndOfPeriod: 63000,
        cashInHandAtEndOfPeriod: 63000,
        cashInBankAtEndOfPeriod: 0,
        newContributionsThisPeriod: 15000,
        interestEarnedThisPeriod: 0,
        loanProcessingFeesCollectedThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0,
        memberRecords: {
          createMany: {
            data: group.memberships.map((membership, index) => ({
              memberId: membership.member.id,
              compulsoryContribution: 5000,
              loanRepaymentPrincipal: index < 2 ? 500 : 0, // First 2 members pay loan
              loanRepaymentInterestRate: index < 2 ? 100 : 0,
              lateFinePaid: 0,
            }))
          }
        }
      }
    });

    console.log(`✅ Created periodic record with ID: ${periodicRecord.id}`);

    console.log('\n🎉 Test data created successfully!');
    console.log('\n📍 You can now test the loan amounts display by:');
    console.log(`   1. Navigate to: /groups/${group.id}/periodic-records/${periodicRecord.id}`);
    console.log(`   2. The member details table should now show:`);
    console.log(`      - Initial Loan Amount column`);
    console.log(`      - Current Loan Balance column`);
    console.log(`      - Member names and periodic contributions`);

    // Show summary of what was created
    console.log('\n📊 Summary of test data:');
    updates.forEach(update => {
      console.log(`   - ${update.name}: Initial loan ₹${update.initialLoanAmount}`);
    });

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the creation script
createTestLoanData();
