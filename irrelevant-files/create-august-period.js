const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPeriodStates() {
  console.log('🔧 Creating August 2025 period for current tracking...');
  
  const groupId = '68499d8a8ebb724c0ebedf0d';
  
  try {
    // Get the last period 
    const lastPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        recordSequenceNumber: 5
      }
    });
    
    console.log('Last period totalCollectionThisPeriod:', lastPeriod.totalCollectionThisPeriod);
    
    // Create August period since we need a proper current period
    console.log('Creating August 2025 period...');
    
    const augustDate = new Date(2025, 7, 10); // August 10, 2025
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { memberships: true }
    });
    
    const augustPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: augustDate,
        recordSequenceNumber: 6,
        totalCollectionThisPeriod: null, // Properly mark as open
        standingAtStartOfPeriod: lastPeriod.totalGroupStandingAtEndOfPeriod || 0,
        cashInBankAtEndOfPeriod: lastPeriod.cashInBankAtEndOfPeriod || 0,
        cashInHandAtEndOfPeriod: lastPeriod.cashInHandAtEndOfPeriod || 0,
        totalGroupStandingAtEndOfPeriod: lastPeriod.totalGroupStandingAtEndOfPeriod || 0,
        interestEarnedThisPeriod: null,
        lateFinesCollectedThisPeriod: null,
        newContributionsThisPeriod: null,
      }
    });
    
    // Create member contributions for August
    const memberContributions = group.memberships.map(membership => ({
      groupPeriodicRecordId: augustPeriod.id,
      memberId: membership.memberId,
      compulsoryContributionDue: group.monthlyContribution || 500,
      loanInterestDue: 0,
      minimumDueAmount: group.monthlyContribution || 500,
      dueDate: augustDate,
      status: 'PENDING',
      compulsoryContributionPaid: 0,
      loanInterestPaid: 0,
      lateFinePaid: 0,
      totalPaid: 0,
      remainingAmount: group.monthlyContribution || 500,
      daysLate: 0,
      lateFineAmount: 0,
    }));
    
    await prisma.memberContribution.createMany({
      data: memberContributions
    });
    
    console.log('✅ Created August 2025 period with', memberContributions.length, 'member contributions');
    
    // Mark July period as closed (0 collection is fine for closed periods)
    await prisma.groupPeriodicRecord.update({
      where: { id: lastPeriod.id },
      data: { totalCollectionThisPeriod: 0 }
    });
    
    console.log('✅ July period properly closed');
    
    // Verify the fix
    const openPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        totalCollectionThisPeriod: null
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });
    
    if (openPeriod) {
      const date = new Date(openPeriod.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`\n🎉 SUCCESS! Current period is now: ${month} (Seq: ${openPeriod.recordSequenceNumber})`);
      console.log('\n🌐 Frontend should now show August 2025 as current period');
      console.log('   Try: http://localhost:3000/groups/68499d8a8ebb724c0ebedf0d/contributions');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPeriodStates().catch(console.error);
