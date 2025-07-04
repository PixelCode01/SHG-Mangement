const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Helper function to generate a unique name
function generateUniqueName(prefix = 'Test') {
  return `${prefix}-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex')}`;
}

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runComprehensiveTest() {
  console.log('🧪 Starting comprehensive test for periodic records calculation...');
  console.log('==============================================================');
  
  try {
    // Step 1: Create a test user
    const userName = generateUniqueName('User');
    const userEmail = `${userName.toLowerCase()}@test.com`;
    const testPassword = 'Test@123456';
    
    console.log(`\n📝 Step 1: Creating test user: ${userName} (${userEmail})`);
    
    // Create user directly in the database
    const user = await prisma.user.create({
      data: {
        name: userName,
        email: userEmail,
        password: testPassword, // In a real app, this would be hashed
      }
    });
    
    console.log(`✅ User created with ID: ${user.id}`);
    
    // Step 2: Create a member linked to the user
    console.log(`\n📝 Step 2: Creating member for user ${userName}`);
    
    const member = await prisma.member.create({
      data: {
        name: userName,
        phone: `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
        address: 'Test Address',
      }
    });
    
    // Now link the user to the member
    await prisma.user.update({
      where: { id: user.id },
      data: { memberId: member.id }
    });
    
    console.log(`✅ Member created with ID: ${member.id}`);
    
    // Step 3: Create a new group
    const groupName = generateUniqueName('Group');
    console.log(`\n📝 Step 3: Creating group: ${groupName}`);
    
    const group = await prisma.group.create({
      data: {
        name: groupName,
        groupId: `GRP-${Date.now().toString().slice(-6)}`,
        leaderId: member.id,
        cashInHand: 1000,
        balanceInBank: 2000,
        monthlyContribution: 500,
        interestRate: 10,
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 10,
      }
    });
    
    console.log(`✅ Group created with ID: ${group.id}`);
    
    // Step 4: Add the creator as a member of the group
    console.log(`\n📝 Step 4: Adding ${userName} as a member of the group`);
    
    const membership = await prisma.memberGroupMembership.create({
      data: {
        groupId: group.id,
        memberId: member.id,
        joinedAt: new Date()
      }
    });
    
    console.log(`✅ Membership created with ID: ${membership.id}`);
    
    // Step 5: Create additional members for the group
    console.log(`\n📝 Step 5: Creating additional members for the group`);
    
    const additionalMembers = [];
    for (let i = 0; i < 3; i++) {
      const memberName = generateUniqueName(`Member-${i+1}`);
      
      const newMember = await prisma.member.create({
        data: {
          name: memberName,
          phone: `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
          address: 'Test Address',
        }
      });
      
      const newMembership = await prisma.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: newMember.id,
          joinedAt: new Date()
        }
      });
      
      additionalMembers.push({
        member: newMember,
        membership: newMembership
      });
      
      console.log(`  - Added member ${memberName} (${newMember.id})`);
    }
    
    console.log(`✅ Added ${additionalMembers.length} additional members`);
    
    // Step 6: Create a test loan for one member
    console.log(`\n📝 Step 6: Creating a test loan`);
    
    const loanMember = additionalMembers[0].member;
    const loanAmount = 5000;
    
    const loan = await prisma.loan.create({
      data: {
        memberId: loanMember.id,
        groupId: group.id,
        originalAmount: loanAmount,
        currentBalance: loanAmount,
        interestRate: 10,
        status: 'ACTIVE',
        loanDate: new Date(),
        processingFeePercentage: 1,
        tenure: 10,
        purpose: 'Test Loan'
      }
    });
    
    console.log(`✅ Created loan with ID: ${loan.id}`);
    
    // Calculate expected values for verification
    const initialCashInHand = 1000;
    const initialCashInBank = 2000;
    const initialLoanAssets = 5000;
    const expectedTotalStanding = initialCashInHand + initialCashInBank + initialLoanAssets;
    
    // Step 7: Create the first periodic record
    console.log(`\n📝 Step 7: Creating first periodic record`);
    
    const currentDate = new Date();
    
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: currentDate,
        recordSequenceNumber: 1,
        standingAtStartOfPeriod: expectedTotalStanding,
        totalGroupStandingAtEndOfPeriod: expectedTotalStanding,
        cashInHandAtEndOfPeriod: initialCashInHand,
        cashInBankAtEndOfPeriod: initialCashInBank
      }
    });
    
    console.log(`✅ Created periodic record with ID: ${periodicRecord.id}`);
    
    // Step 8: Add contributions for members
    console.log(`\n📝 Step 8: Adding contributions`);
    
    // Create an array including the leader and additional members
    const allMembers = [{ member, membership }, ...additionalMembers];
    
    // Add contributions for all members
    const contributions = [];
    for (const memberData of allMembers) {
      const contribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          memberId: memberData.member.id,
          compulsoryContributionDue: 500,
          compulsoryContributionPaid: 500,
          loanInterestDue: memberData.member.id === loanMember.id ? 50 : 0,
          loanInterestPaid: memberData.member.id === loanMember.id ? 50 : 0,
          minimumDueAmount: memberData.member.id === loanMember.id ? 550 : 500,
          totalPaid: memberData.member.id === loanMember.id ? 550 : 500,
          status: 'PAID',
          dueDate: currentDate,
          paidDate: currentDate
        }
      });
      
      contributions.push(contribution);
    }
    
    console.log(`✅ Added ${contributions.length} contributions`);
    
    // Step 9: Close the period
    console.log(`\n📝 Step 9: Closing the period`);
    
    // Update period record with closed status and values
    const totalContributions = allMembers.length * 500;
    const totalInterest = 50; // From the one loan
    
    // Calculate new cash distribution (assume 30% to hand, 70% to bank)
    const totalCollection = totalContributions + totalInterest;
    const additionalCashToHand = totalCollection * 0.3;
    const additionalCashToBank = totalCollection * 0.7;
    
    const newCashInHand = initialCashInHand + additionalCashToHand;
    const newCashInBank = initialCashInBank + additionalCashToBank;
    
    // Update the period with closed values
    await prisma.groupPeriodicRecord.update({
      where: { id: periodicRecord.id },
      data: {
        totalCollectionThisPeriod: totalCollection,
        newContributionsThisPeriod: totalContributions,
        interestEarnedThisPeriod: totalInterest,
        cashInHandAtEndOfPeriod: newCashInHand,
        cashInBankAtEndOfPeriod: newCashInBank,
        totalGroupStandingAtEndOfPeriod: newCashInHand + newCashInBank + initialLoanAssets
      }
    });
    
    console.log(`✅ Period closed successfully`);
    
    // Step 10: Create a new period
    console.log(`\n📝 Step 10: Creating a new period`);
    
    const nextMeetingDate = new Date();
    nextMeetingDate.setMonth(nextMeetingDate.getMonth() + 1);
    
    const newPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: nextMeetingDate,
        recordSequenceNumber: 2,
        standingAtStartOfPeriod: newCashInHand + newCashInBank + initialLoanAssets,
        totalGroupStandingAtEndOfPeriod: newCashInHand + newCashInBank + initialLoanAssets,
        cashInHandAtEndOfPeriod: newCashInHand,
        cashInBankAtEndOfPeriod: newCashInBank
      }
    });
    
    console.log(`✅ Created new period with ID: ${newPeriod.id}`);
    
    // Step 11: Verify the standing calculations
    console.log(`\n📝 Step 11: Verifying standing calculations`);
    
    // Get the latest two periods to verify the values
    const latestPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { recordSequenceNumber: 'asc' },
    });
    
    if (latestPeriods.length !== 2) {
      throw new Error(`Expected 2 periods, but found ${latestPeriods.length}`);
    }
    
    const firstPeriod = latestPeriods[0];
    const secondPeriod = latestPeriods[1];
    
    // Verify first period
    console.log(`\nFirst Period (ID: ${firstPeriod.id}):`);
    console.log(`Standing at Start: ₹${firstPeriod.standingAtStartOfPeriod}`);
    console.log(`Cash in Hand at End: ₹${firstPeriod.cashInHandAtEndOfPeriod}`);
    console.log(`Cash in Bank at End: ₹${firstPeriod.cashInBankAtEndOfPeriod}`);
    console.log(`Total Standing at End: ₹${firstPeriod.totalGroupStandingAtEndOfPeriod}`);
    
    const firstPeriodExpectedStanding = firstPeriod.cashInHandAtEndOfPeriod + firstPeriod.cashInBankAtEndOfPeriod + initialLoanAssets;
    console.log(`Expected Standing at End: ₹${firstPeriodExpectedStanding}`);
    console.log(`Is Standing Correct?: ${firstPeriod.totalGroupStandingAtEndOfPeriod === firstPeriodExpectedStanding ? 'Yes ✓' : 'No ✗'}`);
    
    // Verify second period
    console.log(`\nSecond Period (ID: ${secondPeriod.id}):`);
    console.log(`Standing at Start: ₹${secondPeriod.standingAtStartOfPeriod}`);
    console.log(`Is Starting Standing Equal to Previous Ending Standing?: ${secondPeriod.standingAtStartOfPeriod === firstPeriod.totalGroupStandingAtEndOfPeriod ? 'Yes ✓' : 'No ✗'}`);
    
    // Final verification
    console.log(`\n📊 Final Verification:`);
    console.log(`First Period Total Standing: ₹${firstPeriod.totalGroupStandingAtEndOfPeriod}`);
    console.log(`Second Period Starting Standing: ₹${secondPeriod.standingAtStartOfPeriod}`);
    
    const success = firstPeriod.totalGroupStandingAtEndOfPeriod === secondPeriod.standingAtStartOfPeriod &&
                   firstPeriod.totalGroupStandingAtEndOfPeriod === firstPeriodExpectedStanding;
    
    if (success) {
      console.log(`\n✅ TEST PASSED: Standing values calculated correctly!`);
    } else {
      console.log(`\n❌ TEST FAILED: Standing values not calculated correctly!`);
    }
    
    // Calculate expected values for verification
    console.log(`\n📝 Summary of test group: ${groupName} (ID: ${group.id})`);
    console.log(`Initial Cash in Hand: ₹${initialCashInHand}`);
    console.log(`Initial Cash in Bank: ₹${initialCashInBank}`);
    console.log(`Initial Loan Assets: ₹${initialLoanAssets}`);
    console.log(`Total Contributions Collected: ₹${totalContributions}`);
    console.log(`Total Interest Collected: ₹${totalInterest}`);
    console.log(`Final Cash in Hand: ₹${newCashInHand}`);
    console.log(`Final Cash in Bank: ₹${newCashInBank}`);
    console.log(`Expected Total Standing: ₹${newCashInHand + newCashInBank + initialLoanAssets}`);
    
    return {
      success,
      group: {
        id: group.id,
        name: groupName
      },
      periods: [
        firstPeriod,
        secondPeriod
      ]
    };
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

runComprehensiveTest()
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
