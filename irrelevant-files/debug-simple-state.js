const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCurrentState() {
  try {
    console.log('=== DEBUGGING CURRENT STATE ===\n');
    
    const groupId = '68450d0aba4742c4ab83f661';
    
    // 1. Get group info
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        monthlyContribution: true,
        interestRate: true
      }
    });

    console.log('GROUP INFO:');
    console.log(JSON.stringify(group, null, 2));
    console.log();

    // 2. Get latest periods
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { recordSequenceNumber: 'desc' },
      take: 3,
      select: {
        id: true,
        recordSequenceNumber: true,
        meetingDate: true,
        totalCollectionThisPeriod: true,
        standingAtStartOfPeriod: true,
        cashInHandAtEndOfPeriod: true,
        cashInBankAtEndOfPeriod: true,
        totalGroupStandingAtEndOfPeriod: true,
        interestEarnedThisPeriod: true,
        lateFinesCollectedThisPeriod: true,
        newContributionsThisPeriod: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('LATEST PERIODS:');
    periods.forEach((period, index) => {
      console.log(`Period ${index + 1}:`);
      console.log(JSON.stringify(period, null, 2));
      console.log();
    });

    // 3. Check memberships to get member count
    const memberships = await prisma.memberGroupMembership.findMany({
      where: { groupId: groupId },
      select: {
        memberId: true,
        currentLoanAmount: true
      }
    });

    console.log(`MEMBERSHIPS: ${memberships.length} members`);
    console.log('Member loan amounts:');
    let totalLoans = 0;
    memberships.forEach((membership, index) => {
      const loanAmount = membership.currentLoanAmount || 0;
      totalLoans += loanAmount;
      console.log(`  Member ${index + 1}: ₹${loanAmount}`);
    });
    console.log(`Total loan assets: ₹${totalLoans}`);

    // 4. Check current period contributions
    const currentPeriod = periods.find(p => p.totalCollectionThisPeriod === null);
    if (currentPeriod) {
      console.log('\nCURRENT PERIOD CONTRIBUTIONS:');
      const contributions = await prisma.memberContribution.findMany({
        where: { groupPeriodicRecordId: currentPeriod.id },
        select: {
          memberId: true,
          compulsoryContributionDue: true,
          loanInterestDue: true,
          minimumDueAmount: true,
          totalPaid: true,
          remainingAmount: true,
          status: true
        }
      });
      
      console.log(`Found ${contributions.length} contributions for current period`);
      let totalExpected = 0;
      let totalPaid = 0;
      contributions.forEach((contrib, index) => {
        totalExpected += contrib.minimumDueAmount || 0;
        totalPaid += contrib.totalPaid || 0;
        if (index < 3) { // Show first 3 for brevity
          console.log(`  Contribution ${index + 1}:`, JSON.stringify(contrib, null, 2));
        }
      });
      console.log(`Total expected: ₹${totalExpected}, Total paid: ₹${totalPaid}`);
    } else {
      console.log('\nNo current period found (all periods are closed)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCurrentState();
