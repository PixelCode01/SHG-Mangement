const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCreateNewPeriodAfterClosure() {
  try {
    console.log('=== Testing New Period Creation After Closure ===');
    
    // Find the group that has a closed period but no new period
    const group = await prisma.group.findFirst({
      where: { id: '684532499f26bc7744f83a58' }, // The fds group
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' }
        },
        memberships: {
          select: { 
            member: {
              select: { id: true, currentLoanAmount: true }
            }
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`📊 Group: ${group.name}`);
    console.log(`   Current Periods: ${group.groupPeriodicRecords.length}`);
    
    const lastPeriod = group.groupPeriodicRecords[0];
    console.log(`\n📅 Last Period: #${lastPeriod.recordSequenceNumber}`);
    console.log(`   - Meeting Date: ${lastPeriod.meetingDate.toLocaleDateString()}`);
    console.log(`   - Total Collection: ₹${lastPeriod.totalCollectionThisPeriod?.toFixed(2) || 'N/A'}`);
    console.log(`   - Status: ${lastPeriod.totalCollectionThisPeriod > 0 ? 'CLOSED' : 'OPEN'}`);
    
    // Calculate next period date
    function calculateNextPeriodDate(frequency) {
      const today = new Date();
      
      switch (frequency) {
        case 'WEEKLY':
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          return nextWeek;
          
        case 'FORTNIGHTLY':
          const nextFortnight = new Date(today);
          nextFortnight.setDate(today.getDate() + 14);
          return nextFortnight;
          
        case 'MONTHLY':
          const nextMonth = new Date(today);
          nextMonth.setMonth(today.getMonth() + 1);
          return nextMonth;
          
        case 'YEARLY':
          const nextYear = new Date(today);
          nextYear.setFullYear(today.getFullYear() + 1);
          return nextYear;
          
        default:
          const defaultNext = new Date(today);
          defaultNext.setMonth(today.getMonth() + 1);
          return defaultNext;
      }
    }
    
    // Check if we should create a new period
    if (lastPeriod.totalCollectionThisPeriod > 0) {
      console.log('\n✅ Last period is closed, creating new period...');
      
      const nextPeriodDate = calculateNextPeriodDate(group.collectionFrequency || 'MONTHLY');
      const nextPeriodNumber = (lastPeriod.recordSequenceNumber || 0) + 1;
      
      // Calculate starting balance for new period
      const totalLoanAssets = group.memberships.reduce((sum, membership) => 
        sum + (membership.member.currentLoanAmount || 0), 0
      );
      
      const newCashInHand = lastPeriod.cashInHandAtEndOfPeriod || 0;
      const newCashInBank = lastPeriod.cashInBankAtEndOfPeriod || 0;
      const totalGroupStanding = newCashInHand + newCashInBank + totalLoanAssets;
      
      console.log(`\n💰 New Period Calculations:`);
      console.log(`   - Cash in Hand: ₹${newCashInHand.toFixed(2)}`);
      console.log(`   - Cash in Bank: ₹${newCashInBank.toFixed(2)}`);
      console.log(`   - Total Loan Assets: ₹${totalLoanAssets.toFixed(2)}`);
      console.log(`   - Total Group Standing: ₹${totalGroupStanding.toFixed(2)}`);
      
      // Create new period
      const newPeriod = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: group.id,
          meetingDate: nextPeriodDate,
          recordSequenceNumber: nextPeriodNumber,
          totalCollectionThisPeriod: null, // Start as null to indicate it's empty
          standingAtStartOfPeriod: totalGroupStanding,
          cashInBankAtEndOfPeriod: newCashInBank,
          cashInHandAtEndOfPeriod: newCashInHand,
          totalGroupStandingAtEndOfPeriod: totalGroupStanding,
          interestEarnedThisPeriod: 0,
          lateFinesCollectedThisPeriod: 0,
          newContributionsThisPeriod: 0,
        }
      });
      
      console.log(`\n🎉 New Period Created:`);
      console.log(`   - ID: ${newPeriod.id}`);
      console.log(`   - Period #: ${newPeriod.recordSequenceNumber}`);
      console.log(`   - Meeting Date: ${newPeriod.meetingDate.toLocaleDateString()}`);
      console.log(`   - Total Collection: ${newPeriod.totalCollectionThisPeriod === null ? 'null (ready for contributions)' : newPeriod.totalCollectionThisPeriod}`);
      
      // Create member contributions for the new period
      const memberContributions = group.memberships.map(membership => {
        const expectedContribution = group.monthlyContribution || 0;
        const currentLoanBalance = membership.member.currentLoanAmount || 0;
        const interestRate = (group.interestRate || 0) / 100;
        const expectedInterest = currentLoanBalance * interestRate;

        return {
          groupPeriodicRecordId: newPeriod.id,
          memberId: membership.member.id,
          compulsoryContributionDue: expectedContribution,
          loanInterestDue: expectedInterest,
          minimumDueAmount: expectedContribution + expectedInterest,
          dueDate: nextPeriodDate,
          status: 'PENDING',
          compulsoryContributionPaid: 0,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          totalPaid: 0,
          remainingAmount: expectedContribution + expectedInterest,
          daysLate: 0,
          lateFineAmount: 0,
        };
      });

      await prisma.memberContribution.createMany({
        data: memberContributions
      });
      
      console.log(`\n📝 Created ${memberContributions.length} member contribution records`);
      
      console.log(`\n🔗 View new period at:`);
      console.log(`   http://localhost:3000/groups/${group.id}/contributions`);
      
    } else {
      console.log('\n⚠️  Last period is still open, not creating new period');
    }
    
  } catch (error) {
    console.error('❌ Error testing new period creation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateNewPeriodAfterClosure();
