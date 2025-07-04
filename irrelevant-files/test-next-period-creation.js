const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCreateNextPeriod() {
  try {
    console.log('=== TESTING NEXT PERIOD CREATION ===\n');

    // Get the current closed period
    const closedPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        totalCollectionThisPeriod: { gt: 0 }
      },
      include: {
        group: true,
        memberContributions: {
          include: {
            member: true
          }
        }
      }
    });

    if (!closedPeriod) {
      console.log('❌ No closed period found to test with');
      return;
    }

    console.log(`✅ Found closed period #${closedPeriod.recordSequenceNumber} with ₹${closedPeriod.totalCollectionThisPeriod} collection`);
    console.log(`Group: ${closedPeriod.group.name}`);
    console.log(`Members: ${closedPeriod.memberContributions.length}`);

    // Check if there's already a next period
    const nextSequence = (closedPeriod.recordSequenceNumber || 0) + 1;
    const existingNextPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: closedPeriod.groupId,
        recordSequenceNumber: nextSequence
      }
    });

    if (existingNextPeriod) {
      console.log(`\n📋 Found existing next period #${nextSequence}:`);
      console.log(`  - ID: ${existingNextPeriod.id}`);
      console.log(`  - Meeting Date: ${existingNextPeriod.meetingDate?.toLocaleDateString()}`);
      console.log(`  - Total Collection: ₹${existingNextPeriod.totalCollectionThisPeriod || 0}`);
      console.log(`  - Standing at Start: ₹${existingNextPeriod.standingAtStartOfPeriod || 0}`);
      console.log(`  - Cash in Hand: ₹${existingNextPeriod.cashInHandAtEndOfPeriod || 0}`);
      console.log(`  - Cash in Bank: ₹${existingNextPeriod.cashInBankAtEndOfPeriod || 0}`);

      // Check if it has member contributions
      const nextPeriodContributions = await prisma.memberContribution.findMany({
        where: { groupPeriodicRecordId: existingNextPeriod.id }
      });

      console.log(`  - Member Contributions: ${nextPeriodContributions.length}`);

      if (nextPeriodContributions.length > 0) {
        console.log('\n✅ Next period is properly set up with member contributions');
      } else {
        console.log('\n⚠️  Next period exists but has no member contributions - this could be an issue');
      }
    } else {
      console.log(`\n❌ No next period #${nextSequence} found - system is not tracking for next period!`);
      
      // Let's manually create what should be the next period
      console.log('\n🏗️  Creating next period to fix tracking...');
      
      // Calculate next period date
      const frequency = closedPeriod.group.collectionFrequency || 'MONTHLY';
      const today = new Date();
      let nextPeriodDate;
      
      switch (frequency) {
        case 'WEEKLY':
          nextPeriodDate = new Date(today);
          nextPeriodDate.setDate(today.getDate() + 7);
          break;
        case 'FORTNIGHTLY':
          nextPeriodDate = new Date(today);
          nextPeriodDate.setDate(today.getDate() + 14);
          break;
        case 'MONTHLY':
          nextPeriodDate = new Date(today);
          nextPeriodDate.setMonth(today.getMonth() + 1);
          break;
        case 'YEARLY':
          nextPeriodDate = new Date(today);
          nextPeriodDate.setFullYear(today.getFullYear() + 1);
          break;
        default:
          nextPeriodDate = new Date(today);
          nextPeriodDate.setMonth(today.getMonth() + 1);
      }

      // Get current group financial state
      const group = closedPeriod.group;
      const currentCashInHand = group.cashInHand || 0;
      const currentCashInBank = group.balanceInBank || 0;
      
      // Get total loan assets
      const totalLoanAssets = await prisma.member.aggregate({
        where: {
          memberships: {
            some: { groupId: closedPeriod.groupId }
          }
        },
        _sum: {
          currentLoanAmount: true
        }
      });
      
      const totalLoanAmount = totalLoanAssets._sum.currentLoanAmount || 0;
      const totalGroupStanding = currentCashInHand + currentCashInBank + totalLoanAmount;

      console.log(`Next period calculations:`);
      console.log(`  - Cash in Hand: ₹${currentCashInHand}`);
      console.log(`  - Cash in Bank: ₹${currentCashInBank}`);
      console.log(`  - Total Loan Assets: ₹${totalLoanAmount}`);
      console.log(`  - Total Group Standing: ₹${totalGroupStanding}`);
      console.log(`  - Next Meeting Date: ${nextPeriodDate.toLocaleDateString()}`);

      // Create the next period
      const newPeriod = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: closedPeriod.groupId,
          meetingDate: nextPeriodDate,
          recordSequenceNumber: nextSequence,
          totalCollectionThisPeriod: 0,
          standingAtStartOfPeriod: totalGroupStanding,
          cashInBankAtEndOfPeriod: currentCashInBank,
          cashInHandAtEndOfPeriod: currentCashInHand,
          totalGroupStandingAtEndOfPeriod: totalGroupStanding,
          interestEarnedThisPeriod: 0,
          lateFinesCollectedThisPeriod: 0,
          newContributionsThisPeriod: 0,
        }
      });

      console.log(`✅ Created new period #${nextSequence} with ID: ${newPeriod.id}`);

      // Create member contributions for the new period
      console.log('\n🧑‍🤝‍🧑 Creating member contributions for new period...');

      const memberContributions = [];
      
      for (const contribution of closedPeriod.memberContributions) {
        const carryForwardAmount = contribution.remainingAmount || 0;
        const expectedContribution = group.monthlyContribution || 0;
        const currentLoanBalance = contribution.member.currentLoanAmount || 0;
        const interestRate = (group.interestRate || 0) / 100;
        const expectedInterest = currentLoanBalance * interestRate;

        memberContributions.push({
          groupPeriodicRecordId: newPeriod.id,
          memberId: contribution.memberId,
          compulsoryContributionDue: expectedContribution + carryForwardAmount,
          loanInterestDue: expectedInterest,
          minimumDueAmount: expectedContribution + carryForwardAmount + expectedInterest,
          dueDate: nextPeriodDate,
          status: 'PENDING',
          compulsoryContributionPaid: 0,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          totalPaid: 0,
          remainingAmount: expectedContribution + carryForwardAmount + expectedInterest,
          daysLate: 0,
          lateFineAmount: 0,
        });
      }

      await prisma.memberContribution.createMany({
        data: memberContributions
      });

      console.log(`✅ Created ${memberContributions.length} member contributions for new period`);
      console.log('\n🎉 Next period tracking is now properly set up!');
    }

    // Final verification
    console.log('\n🔍 FINAL VERIFICATION:');
    console.log('═'.repeat(50));
    
    const allPeriodsAfter = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: closedPeriod.groupId },
      orderBy: { recordSequenceNumber: 'asc' },
      include: {
        _count: {
          select: { memberContributions: true }
        }
      }
    });

    allPeriodsAfter.forEach(period => {
      const isOpen = period.totalCollectionThisPeriod === 0;
      console.log(`Period #${period.recordSequenceNumber}: ${isOpen ? 'OPEN' : 'CLOSED'} - ₹${period.totalCollectionThisPeriod || 0} - ${period._count.memberContributions} contributions`);
    });

    const openPeriods = allPeriodsAfter.filter(p => p.totalCollectionThisPeriod === 0);
    console.log(`\n${openPeriods.length > 0 ? '✅ System is tracking for next period' : '❌ System is NOT tracking for next period'}`);

  } catch (error) {
    console.error('❌ Error during next period test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateNextPeriod();
