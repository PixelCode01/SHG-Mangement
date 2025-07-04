const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureCurrentPeriodIsAugust() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔧 Ensuring Current Period is August...');
  console.log('======================================');

  try {
    // Get all periods for this group
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { recordSequenceNumber: 'asc' },
      include: {
        memberContributions: true
      }
    });

    console.log(`\n📊 Current Periods Status:`);
    periods.forEach((period, index) => {
      const date = period.meetingDate.toISOString().split('T')[0];
      const month = new Date(period.meetingDate).toLocaleString('default', { month: 'long', year: 'numeric' });
      const isClosedPeriod = period.totalCollectionThisPeriod && period.totalCollectionThisPeriod > 0;
      const status = isClosedPeriod ? 'CLOSED' : 'OPEN';
      
      console.log(`  Period ${index + 1}: ${month} (${date}) - Sequence ${period.recordSequenceNumber} - ${status}`);
      console.log(`    Collection: ₹${period.totalCollectionThisPeriod || 0}`);
      console.log(`    Member Contributions: ${period.memberContributions.length}`);
    });

    // Find the August period (should be the current open period)
    const augustPeriod = periods.find(p => 
      new Date(p.meetingDate).getMonth() === 7 && // August = month 7 (0-indexed)
      new Date(p.meetingDate).getFullYear() === 2025
    );

    if (!augustPeriod) {
      console.log('\n❌ August period not found!');
      return;
    }

    console.log(`\n🔍 August Period Analysis:`);
    console.log(`  ID: ${augustPeriod.id}`);
    console.log(`  Date: ${augustPeriod.meetingDate.toISOString()}`);
    console.log(`  Sequence: ${augustPeriod.recordSequenceNumber}`);
    console.log(`  Collection: ₹${augustPeriod.totalCollectionThisPeriod || 0}`);
    console.log(`  Standing: ₹${augustPeriod.totalGroupStandingAtEndOfPeriod || 0}`);
    console.log(`  Member Contributions: ${augustPeriod.memberContributions.length}`);

    // Check if member contributions are properly set up for August
    console.log(`\n👥 Member Contributions for August:`);
    if (augustPeriod.memberContributions.length === 0) {
      console.log(`  ❌ No member contributions found for August period`);
      console.log(`  This might be why frontend shows July as current`);
      
      // Get members from the previous period to create contributions for August
      const julyPeriod = periods.find(p => p.recordSequenceNumber === 2);
      if (julyPeriod && julyPeriod.memberContributions.length > 0) {
        console.log(`\n🔄 Creating member contributions for August based on July members...`);
        
        const baseContribution = 500; // Default contribution amount
        const augustContributions = [];
        
        for (const julyContrib of julyPeriod.memberContributions) {
          augustContributions.push({
            groupPeriodicRecordId: augustPeriod.id,
            memberId: julyContrib.memberId,
            compulsoryContributionDue: baseContribution,
            loanInterestDue: 0, // Will be calculated based on loans
            minimumDueAmount: baseContribution,
            dueDate: augustPeriod.meetingDate,
            status: 'PENDING',
            compulsoryContributionPaid: 0,
            loanInterestPaid: 0,
            lateFinePaid: 0,
            totalPaid: 0,
            remainingAmount: baseContribution,
            daysLate: 0,
            lateFineAmount: 0
          });
        }
        
        // Create the member contributions
        await prisma.memberContribution.createMany({
          data: augustContributions
        });
        
        console.log(`✅ Created ${augustContributions.length} member contributions for August`);
      }
    } else {
      console.log(`  ✅ Found ${augustPeriod.memberContributions.length} member contributions`);
      
      // Check the status of contributions
      const contributionStatuses = {};
      augustPeriod.memberContributions.forEach(contrib => {
        const status = contrib.status || 'UNKNOWN';
        contributionStatuses[status] = (contributionStatuses[status] || 0) + 1;
      });
      
      console.log(`  Status breakdown:`, contributionStatuses);
    }

    // Verify that August is indeed the latest period
    const latestPeriod = periods[periods.length - 1];
    const isAugustLatest = latestPeriod.id === augustPeriod.id;
    
    console.log(`\n📅 Period Status Verification:`);
    console.log(`  Latest period: Sequence ${latestPeriod.recordSequenceNumber} (${new Date(latestPeriod.meetingDate).toLocaleString('default', { month: 'long', year: 'numeric' })})`);
    console.log(`  Is August the latest period: ${isAugustLatest ? 'YES ✓' : 'NO ✗'}`);
    
    if (isAugustLatest) {
      console.log(`\n🎉 August is correctly set as the current period!`);
      console.log(`\nIf frontend still shows July, the issue is in:`);
      console.log(`1. Frontend caching - try hard refresh (Ctrl+F5)`);
      console.log(`2. Frontend API call logic - check which endpoint it's using`);
      console.log(`3. Frontend period detection logic - check how it determines "current"`);
    } else {
      console.log(`\n⚠️ August is not the latest period - this needs to be fixed`);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureCurrentPeriodIsAugust()
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
