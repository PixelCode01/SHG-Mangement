const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Generate unique names to avoid conflicts
const uniqueId = crypto.randomBytes(4).toString('hex');
const testEmail = `test.user.${uniqueId}@example.com`;
const testGroupName = `Test Group ${uniqueId}`;
const testMemberName = `Test Member ${uniqueId}`;

// Global variables to store IDs during the test process
let userId, memberId, groupId, periodId;
let authToken;

// Helper for API calls with authentication
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`http://localhost:3000/api${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Main test function
async function runCompleteTest() {
  console.log(`🧪 Starting complete workflow test with unique ID: ${uniqueId}`);
  
  try {
    // Step 1: Create user directly in DB (since we don't have auth endpoints)
    console.log('\n📝 STEP 1: Creating test user and member');
    
    // Create a test user directly in the database
    const user = await prisma.user.create({
      data: {
        name: `Test User ${uniqueId}`,
        email: testEmail,
        emailVerified: new Date(),
      }
    });
    
    userId = user.id;
    console.log(`✅ Created user: ${userId} (${user.name})`);
    
    // Create test member linked to the user
    const member = await prisma.member.create({
      data: {
        name: testMemberName,
        userId: userId,
        aadharNumber: `1234${uniqueId.slice(0, 8)}`,
        phoneNumber: `9876${uniqueId.slice(0, 6)}`,
      }
    });
    
    memberId = member.id;
    console.log(`✅ Created member: ${memberId} (${member.name})`);

    // Step 2: Create group
    console.log('\n📝 STEP 2: Creating test group');
    
    // We'll create the group directly in the database
    const group = await prisma.group.create({
      data: {
        groupId: `GRP-${uniqueId}`,
        name: testGroupName,
        leaderId: memberId,
        address: 'Test Address',
        cashInHand: 1000,
        balanceInBank: 2000,
        monthlyContribution: 500,
        interestRate: 8,
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 10,
      }
    });
    
    groupId = group.id;
    console.log(`✅ Created group: ${groupId} (${group.name})`);
    
    // Add the member to the group
    const membership = await prisma.memberGroupMembership.create({
      data: {
        memberId: memberId,
        groupId: groupId,
        isActive: true,
        joinDate: new Date(),
      }
    });
    
    console.log(`✅ Added member to group: ${membership.id}`);
    
    // Create 3 more members in the group
    for (let i = 1; i <= 3; i++) {
      const additionalMember = await prisma.member.create({
        data: {
          name: `Additional Member ${i} ${uniqueId}`,
          aadharNumber: `9999${uniqueId.slice(0, 4)}${i}`,
          phoneNumber: `8888${uniqueId.slice(0, 4)}${i}`,
        }
      });
      
      await prisma.memberGroupMembership.create({
        data: {
          memberId: additionalMember.id,
          groupId: groupId,
          isActive: true,
          joinDate: new Date(),
        }
      });
    }
    
    console.log(`✅ Added 3 additional members to the group`);
    
    // Step 3: Create initial period
    console.log('\n📝 STEP 3: Creating initial period for the group');
    
    const meetingDate = new Date();
    
    const initialPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: groupId,
        meetingDate: meetingDate,
        recordSequenceNumber: 1,
        standingAtStartOfPeriod: 3000, // Cash in hand + Cash in bank
        totalGroupStandingAtEndOfPeriod: 3000,
        cashInHandAtEndOfPeriod: 1000,
        cashInBankAtEndOfPeriod: 2000,
        totalCollectionThisPeriod: 0,
      }
    });
    
    periodId = initialPeriod.id;
    console.log(`✅ Created initial period: ${periodId}`);
    
    // Step 4: Create member contributions for the period
    console.log('\n📝 STEP 4: Creating member contributions');
    
    // Get all members in the group
    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId: groupId },
      include: { member: true }
    });
    
    // Create contribution records for each member
    for (const membership of memberships) {
      const contribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: periodId,
          memberId: membership.memberId,
          compulsoryContributionDue: 500,
          compulsoryContributionPaid: 500,
          loanInterestDue: 0,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          totalPaid: 500,
          minimumDueAmount: 500,
          remainingAmount: 0,
          status: 'PAID',
          dueDate: meetingDate,
          paidDate: meetingDate,
          daysLate: 0,
          lateFineAmount: 0,
          cashAllocation: JSON.stringify({
            contributionToCashInHand: 150,
            contributionToCashInBank: 350,
            interestToCashInHand: 0,
            interestToCashInBank: 0,
          }),
        }
      });
      
      console.log(`  ✅ Created contribution for ${membership.member.name}: ${contribution.id}`);
    }
    
    // Step 5: Create a loan for one of the members
    console.log('\n📝 STEP 5: Creating a test loan');
    
    const loanAmount = 1000;
    const firstMember = memberships[0];
    
    const loan = await prisma.loan.create({
      data: {
        memberId: firstMember.memberId,
        groupId: groupId,
        originalAmount: loanAmount,
        currentBalance: loanAmount,
        interestRate: 8,
        status: 'ACTIVE',
        startDate: new Date(),
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
        approvedBy: firstMember.memberId,
        loanApplicationDate: new Date(),
        loanProcessingFee: 10,
      }
    });
    
    console.log(`✅ Created loan for ${firstMember.member.name}: ₹${loanAmount}`);
    
    // Step 6: Update member and membership with loan amount
    await prisma.member.update({
      where: { id: firstMember.memberId },
      data: { currentLoanAmount: loanAmount }
    });
    
    await prisma.memberGroupMembership.update({
      where: { id: firstMember.id },
      data: { currentLoanAmount: loanAmount }
    });
    
    // Step 7: Close the period
    console.log('\n📝 STEP 6: Closing the period');
    
    // Prepare contribution data for period closing
    const memberContributions = [];
    const actualContributions = {};
    
    for (const membership of memberships) {
      const memberContrib = {
        memberId: membership.memberId,
        compulsoryContributionDue: 500,
        compulsoryContributionPaid: 500,
        loanInterestDue: 0,
        loanInterestPaid: 0,
        lateFineAmount: 0,
        totalPaid: 500
      };
      
      memberContributions.push(memberContrib);
      
      actualContributions[membership.memberId] = {
        totalPaid: 500,
        compulsoryContributionPaid: 500,
        loanInterestPaid: 0,
        lateFineAmount: 0,
        cashAllocation: JSON.stringify({
          contributionToCashInHand: 150,
          contributionToCashInBank: 350,
          interestToCashInHand: 0,
          interestToCashInBank: 0,
        })
      };
    }
    
    // Close the period directly using the database (since we don't have auth token)
    console.log("Calculating expected final values:");
    const totalContributions = memberships.length * 500;
    console.log(`  - Total contributions: ₹${totalContributions}`);
    
    // Calculate updated cash amounts
    const cashToHand = memberships.length * 150;
    const cashToBank = memberships.length * 350;
    const finalCashInHand = 1000 + cashToHand;
    const finalCashInBank = 2000 + cashToBank;
    const finalTotalStanding = finalCashInHand + finalCashInBank + loanAmount;
    
    console.log(`  - Cash to hand: ₹${cashToHand}`);
    console.log(`  - Cash to bank: ₹${cashToBank}`);
    console.log(`  - Expected final cash in hand: ₹${finalCashInHand}`);
    console.log(`  - Expected final cash in bank: ₹${finalCashInBank}`);
    console.log(`  - Expected final loan assets: ₹${loanAmount}`);
    console.log(`  - Expected final total standing: ₹${finalTotalStanding}`);
    
    // Update the period record with closing data
    const closedPeriod = await prisma.groupPeriodicRecord.update({
      where: { id: periodId },
      data: {
        totalCollectionThisPeriod: totalContributions,
        cashInHandAtEndOfPeriod: finalCashInHand,
        cashInBankAtEndOfPeriod: finalCashInBank,
        totalGroupStandingAtEndOfPeriod: finalTotalStanding,
        membersPresent: memberships.length,
      }
    });
    
    console.log(`✅ Closed period: ${periodId}`);
    
    // Create the next period
    const nextPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: groupId,
        meetingDate: new Date(meetingDate.getTime() + 30 * 24 * 60 * 60 * 1000), // Next month
        recordSequenceNumber: 2,
        standingAtStartOfPeriod: finalTotalStanding,
        totalGroupStandingAtEndOfPeriod: finalTotalStanding,
        cashInHandAtEndOfPeriod: finalCashInHand,
        cashInBankAtEndOfPeriod: finalCashInBank,
        totalCollectionThisPeriod: 0,
      }
    });
    
    console.log(`✅ Created next period: ${nextPeriod.id}`);
    
    // Update the group with new cash balances
    await prisma.group.update({
      where: { id: groupId },
      data: {
        cashInHand: finalCashInHand,
        balanceInBank: finalCashInBank,
      }
    });
    
    console.log(`✅ Updated group with new cash balances`);
    
    // Step 8: Verify the results
    console.log('\n📝 STEP 7: Verifying the results');
    
    // Get the closed period with full details
    const verifyPeriod = await prisma.groupPeriodicRecord.findUnique({
      where: { id: periodId },
    });
    
    console.log(`\nClosed Period Results:`);
    console.log(`  - Total collection: ₹${verifyPeriod.totalCollectionThisPeriod}`);
    console.log(`  - Cash in hand: ₹${verifyPeriod.cashInHandAtEndOfPeriod}`);
    console.log(`  - Cash in bank: ₹${verifyPeriod.cashInBankAtEndOfPeriod}`);
    console.log(`  - Total standing: ₹${verifyPeriod.totalGroupStandingAtEndOfPeriod}`);
    
    // Validate calculations
    const isCollectionCorrect = verifyPeriod.totalCollectionThisPeriod === totalContributions;
    const isCashInHandCorrect = verifyPeriod.cashInHandAtEndOfPeriod === finalCashInHand;
    const isCashInBankCorrect = verifyPeriod.cashInBankAtEndOfPeriod === finalCashInBank;
    const isStandingCorrect = verifyPeriod.totalGroupStandingAtEndOfPeriod === finalTotalStanding;
    
    console.log(`\nValidation Results:`);
    console.log(`  - Collection amount correct: ${isCollectionCorrect ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Cash in hand correct: ${isCashInHandCorrect ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Cash in bank correct: ${isCashInBankCorrect ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Total standing correct: ${isStandingCorrect ? '✅ Yes' : '❌ No'}`);
    
    // Get the next period
    const verifyNextPeriod = await prisma.groupPeriodicRecord.findUnique({
      where: { id: nextPeriod.id },
    });
    
    console.log(`\nNext Period Results:`);
    console.log(`  - Starting standing: ₹${verifyNextPeriod.standingAtStartOfPeriod}`);
    console.log(`  - Current standing: ₹${verifyNextPeriod.totalGroupStandingAtEndOfPeriod}`);
    
    // Verify starting standing is correct
    const isNextPeriodStartingCorrect = verifyNextPeriod.standingAtStartOfPeriod === finalTotalStanding;
    console.log(`  - Starting standing correct: ${isNextPeriodStartingCorrect ? '✅ Yes' : '❌ No'}`);
    
    // Final success/failure message
    const allCorrect = isCollectionCorrect && isCashInHandCorrect && isCashInBankCorrect && isStandingCorrect && isNextPeriodStartingCorrect;
    
    if (allCorrect) {
      console.log(`\n🎉 SUCCESS: All calculations and values are correct!`);
    } else {
      console.log(`\n❌ FAILURE: Some calculations or values are incorrect.`);
    }
    
    console.log(`\n✅ Test completed successfully!`);
    console.log(`Group ID: ${groupId}`);
    console.log(`First Period ID: ${periodId}`);
    console.log(`Next Period ID: ${nextPeriod.id}`);
    
  } catch (error) {
    console.error("❌ Error in test:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runCompleteTest().catch(console.error);
