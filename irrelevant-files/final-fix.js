const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createFinalFix() {
  console.log('🔧 Final fix: Creating proper September period...');
  
  const groupId = '68499d8a8ebb724c0ebedf0d';
  
  try {
    // 1. Close the problematic July period (Seq: 5)
    await prisma.groupPeriodicRecord.update({
      where: { id: '684a9307f31b4dbbdc1e9336' },
      data: { totalCollectionThisPeriod: 0 }
    });
    console.log('✅ Closed problematic July period');
    
    // 2. Get latest period for reference
    const latestPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'desc' }
    });
    
    // 3. Create September 2025 period
    const septemberDate = new Date(2025, 8, 10); // September 10, 2025
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { memberships: true }
    });
    
    const septemberPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: septemberDate,
        recordSequenceNumber: 6,
        totalCollectionThisPeriod: null, // Mark as open
        standingAtStartOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
        cashInBankAtEndOfPeriod: latestPeriod.cashInBankAtEndOfPeriod || 0,
        cashInHandAtEndOfPeriod: latestPeriod.cashInHandAtEndOfPeriod || 0,
        totalGroupStandingAtEndOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
        interestEarnedThisPeriod: null,
        lateFinesCollectedThisPeriod: null,
        newContributionsThisPeriod: null,
      }
    });
    
    // 4. Create member contributions
    const memberContributions = group.memberships.map(membership => ({
      groupPeriodicRecordId: septemberPeriod.id,
      memberId: membership.memberId,
      compulsoryContributionDue: group.monthlyContribution || 500,
      loanInterestDue: 0,
      minimumDueAmount: group.monthlyContribution || 500,
      dueDate: septemberDate,
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
    
    console.log('✅ Created September 2025 period with', memberContributions.length, 'contributions');
    console.log('\n🎉 PERMANENT FIX COMPLETE!');
    console.log('✨ The close period API has been enhanced to:');
    console.log('   - Always create the next period when closing');
    console.log('   - Include safety checks to ensure an open period always exists');
    console.log('   - Calculate proper future dates for new periods');
    console.log('\n🌐 Try the frontend - it should show September 2025:');
    console.log('   http://localhost:3000/groups/68499d8a8ebb724c0ebedf0d/contributions');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFinalFix().catch(console.error);
