const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosureWithNextPeriod() {
  try {
    console.log('=== TESTING PERIOD CLOSURE WITH NEXT PERIOD CREATION ===\n');

    // First, let's create a test scenario with a period that has contributions but isn't closed yet
    console.log('🏗️  Setting up test scenario...');

    // Get the group
    const group = await prisma.group.findFirst();
    if (!group) {
      console.log('❌ No group found');
      return;
    }

    // Clean up - remove the period we just created for a clean test
    await prisma.memberContribution.deleteMany({
      where: {
        groupPeriodicRecord: {
          recordSequenceNumber: 2
        }
      }
    });

    await prisma.groupPeriodicRecord.deleteMany({
      where: {
        groupId: group.id,
        recordSequenceNumber: 2
      }
    });

    console.log('✅ Cleaned up test data');

    // Verify current state
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { recordSequenceNumber: 'asc' }
    });

    console.log(`Current periods: ${allPeriods.length}`);
    allPeriods.forEach(p => {
      console.log(`  - Period #${p.recordSequenceNumber}: ₹${p.totalCollectionThisPeriod || 0} (${p.totalCollectionThisPeriod === 0 ? 'OPEN' : 'CLOSED'})`);
    });

    // Now create a new auto-created period to test the closure logic
    console.log('\n🎯 Creating auto-created period for testing...');
    
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    const autoPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: group.id,
        meetingDate: nextMonth,
        recordSequenceNumber: 2,
        totalCollectionThisPeriod: 0,
        standingAtStartOfPeriod: 13802,
        cashInBankAtEndOfPeriod: group.balanceInBank || 0,
        cashInHandAtEndOfPeriod: group.cashInHand || 0,
        totalGroupStandingAtEndOfPeriod: 13802,
        interestEarnedThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0,
        newContributionsThisPeriod: 0,
      }
    });

    console.log(`✅ Created auto-created period #2 with ID: ${autoPeriod.id}`);

    // Create member contributions for this auto-created period
    const members = await prisma.member.findMany({
      where: {
        memberships: {
          some: { groupId: group.id }
        }
      }
    });

    const memberContributions = members.map(member => ({
      groupPeriodicRecordId: autoPeriod.id,
      memberId: member.id,
      compulsoryContributionDue: group.monthlyContribution || 0,
      loanInterestDue: 0,
      minimumDueAmount: group.monthlyContribution || 0,
      dueDate: nextMonth,
      status: 'PENDING',
      compulsoryContributionPaid: 0,
      loanInterestPaid: 0,
      lateFinePaid: 0,
      totalPaid: 0,
      remainingAmount: group.monthlyContribution || 0,
      daysLate: 0,
      lateFineAmount: 0,
    }));

    await prisma.memberContribution.createMany({
      data: memberContributions
    });

    console.log(`✅ Created ${memberContributions.length} member contributions for auto-created period`);

    // Now simulate some contributions being made
    console.log('\n💰 Simulating contributions being made to auto-created period...');
    
    const contributionsToUpdate = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: autoPeriod.id },
      take: 3
    });

    let totalPaid = 0;
    for (const contrib of contributionsToUpdate) {
      const paymentAmount = 545; // Monthly contribution
      await prisma.memberContribution.update({
        where: { id: contrib.id },
        data: {
          compulsoryContributionPaid: paymentAmount,
          totalPaid: paymentAmount,
          remainingAmount: Math.max(0, contrib.compulsoryContributionDue - paymentAmount),
          status: contrib.compulsoryContributionDue <= paymentAmount ? 'PAID' : 'PARTIAL'
        }
      });
      totalPaid += paymentAmount;
    }

    console.log(`✅ Updated ${contributionsToUpdate.length} contributions with total payments of ₹${totalPaid}`);

    // Now test what happens when we "close" this auto-created period
    console.log('\n🔄 Testing closure of auto-created period with contributions...');

    // Simulate the closure logic from the API
    const periodToClose = await prisma.groupPeriodicRecord.findUnique({
      where: { id: autoPeriod.id },
      select: { 
        totalCollectionThisPeriod: true,
        recordSequenceNumber: true,
        groupId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (periodToClose) {
      const timeSinceCreation = new Date().getTime() - periodToClose.createdAt.getTime();
      const isRecentlyCreated = timeSinceCreation < 300000; // 5 minutes
      const neverUpdated = Math.abs(periodToClose.createdAt.getTime() - periodToClose.updatedAt.getTime()) < 1000;
      const isAutoCreatedPeriod = periodToClose.totalCollectionThisPeriod === 0 && (isRecentlyCreated || neverUpdated);

      console.log(`Period analysis:`);
      console.log(`  - Total Collection: ₹${periodToClose.totalCollectionThisPeriod}`);
      console.log(`  - Time since creation: ${Math.round(timeSinceCreation / 1000)}s`);
      console.log(`  - Recently created: ${isRecentlyCreated}`);
      console.log(`  - Never updated: ${neverUpdated}`);
      console.log(`  - Detected as auto-created: ${isAutoCreatedPeriod}`);

      if (isAutoCreatedPeriod) {
        console.log('\n⚠️  ISSUE IDENTIFIED: Auto-created period with contributions is not being properly updated!');
        console.log('The period has contributions but is still being detected as auto-created.');
        console.log('This means when "closed", it will just update the existing record instead of creating a next period.');
        
        // Let's manually test what should happen
        console.log('\n🔧 Testing the correct logic...');
        
        // Update the auto-created period with the actual collection data
        await prisma.groupPeriodicRecord.update({
          where: { id: autoPeriod.id },
          data: {
            totalCollectionThisPeriod: totalPaid,
            updatedAt: new Date()
          }
        });

        console.log(`✅ Updated auto-created period with ₹${totalPaid} collection`);

        // Now check if there's a next period or if we need to create one
        const nextSequence = (periodToClose.recordSequenceNumber || 0) + 1;
        const existingNextPeriod = await prisma.groupPeriodicRecord.findFirst({
          where: {
            groupId: periodToClose.groupId,
            recordSequenceNumber: nextSequence
          }
        });

        if (!existingNextPeriod) {
          console.log(`❌ No next period #${nextSequence} found - need to create one!`);
          
          // This is the missing logic - we should create a next period
          const nextPeriodDate = new Date(today);
          nextPeriodDate.setMonth(today.getMonth() + 2); // Next month from our test period

          const newPeriod = await prisma.groupPeriodicRecord.create({
            data: {
              groupId: group.id,
              meetingDate: nextPeriodDate,
              recordSequenceNumber: nextSequence,
              totalCollectionThisPeriod: 0,
              standingAtStartOfPeriod: 13802 + totalPaid,
              cashInBankAtEndOfPeriod: (group.balanceInBank || 0) + (totalPaid * 0.7),
              cashInHandAtEndOfPeriod: (group.cashInHand || 0) + (totalPaid * 0.3),
              totalGroupStandingAtEndOfPeriod: 13802 + totalPaid,
              interestEarnedThisPeriod: 0,
              lateFinesCollectedThisPeriod: 0,
              newContributionsThisPeriod: 0,
            }
          });

          console.log(`✅ Created next period #${nextSequence} with ID: ${newPeriod.id}`);
          
          // Create member contributions for the next period
          const nextMemberContributions = members.map(member => ({
            groupPeriodicRecordId: newPeriod.id,
            memberId: member.id,
            compulsoryContributionDue: group.monthlyContribution || 0,
            loanInterestDue: 0,
            minimumDueAmount: group.monthlyContribution || 0,
            dueDate: nextPeriodDate,
            status: 'PENDING',
            compulsoryContributionPaid: 0,
            loanInterestPaid: 0,
            lateFinePaid: 0,
            totalPaid: 0,
            remainingAmount: group.monthlyContribution || 0,
            daysLate: 0,
            lateFineAmount: 0,
          }));

          await prisma.memberContribution.createMany({
            data: nextMemberContributions
          });

          console.log(`✅ Created member contributions for next period`);
        }
      }
    }

    // Final verification
    console.log('\n🔍 FINAL STATE:');
    console.log('═'.repeat(50));
    
    const finalPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { recordSequenceNumber: 'asc' },
      include: {
        _count: {
          select: { memberContributions: true }
        }
      }
    });

    finalPeriods.forEach(period => {
      const isOpen = period.totalCollectionThisPeriod === 0;
      console.log(`Period #${period.recordSequenceNumber}: ${isOpen ? 'OPEN' : 'CLOSED'} - ₹${period.totalCollectionThisPeriod || 0} - ${period._count.memberContributions} contributions`);
    });

    const openPeriods = finalPeriods.filter(p => p.totalCollectionThisPeriod === 0);
    console.log(`\n${openPeriods.length > 0 ? '✅ System is tracking for next period' : '❌ System is NOT tracking for next period'}`);

  } catch (error) {
    console.error('❌ Error during period closure test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosureWithNextPeriod();
