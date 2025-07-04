const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createProperNextPeriod() {
  console.log('    console.log('\n✨ From now on, when you close periods, the API will automatically');️ Creating proper next period after fixing the close period API...\n');
  
  const groupId = '68499d8a8ebb724c0ebedf0d';
  
  try {
    // 1. Check current state
    console.log('📊 1. Current state:');
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' }
    });
    
    periods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      
      console.log(`  ${index + 1}. ${month} (Seq: ${period.recordSequenceNumber}) - ${status}`);
    });
    
    // 2. Check if there's already an open period
    const openPeriod = periods.find(p => p.totalCollectionThisPeriod === null || p.totalCollectionThisPeriod === 0);
    
    if (openPeriod) {
      const date = new Date(openPeriod.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });        console.log(`\n✅ Already have open period: ${month} (Seq: ${openPeriod.recordSequenceNumber})`);
      
      // Check if it's a proper future period
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const periodMonth = date.getMonth();
      const periodYear = date.getFullYear();
      
      if (periodYear > currentYear || (periodYear === currentYear && periodMonth >= currentMonth)) {
        console.log('✅ Open period is current or future - good!');
        console.log('\n🌐 Try the frontend now:');
        console.log('   http://localhost:3000/groups/68499d8a8ebb724c0ebedf0d/contributions');
        return;
      } else {
        console.log('⚠️ Open period is in the past - should create a current period');
        
        // Mark this period as closed since it's in the past
        await prisma.groupPeriodicRecord.update({
          where: { id: openPeriod.id },
          data: { totalCollectionThisPeriod: 0 }
        });
        
        console.log('🔒 Marked past period as closed');
      }
    }
    
    // 3. Create a proper next period for current month or next month
    const today = new Date();
    const nextPeriodDate = new Date(today.getFullYear(), today.getMonth(), 10); // 10th of current month
    
    // If we're past the 10th, move to next month
    if (today.getDate() > 10) {
      nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1);
    }
    
    const nextMonth = nextPeriodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    console.log(`\n📅 2. Creating proper next period for ${nextMonth}...`);
    
    // Get latest period for sequence numbering
    const latestPeriod = periods[periods.length - 1];
    const nextSequence = (latestPeriod.recordSequenceNumber || 0) + 1;
    
    // Get group details
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: { member: true }
        }
      }
    });
    
    // Create the proper next period
    const nextPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: nextPeriodDate,
        recordSequenceNumber: nextSequence,
        totalCollectionThisPeriod: null, // Mark as OPEN
        standingAtStartOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
        cashInBankAtEndOfPeriod: latestPeriod.cashInBankAtEndOfPeriod || 0,
        cashInHandAtEndOfPeriod: latestPeriod.cashInHandAtEndOfPeriod || 0,
        totalGroupStandingAtEndOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
        interestEarnedThisPeriod: null,
        lateFinesCollectedThisPeriod: null,
        newContributionsThisPeriod: null,
      }
    });
    
    console.log(`✅ Created next period: ${nextPeriod.id} (Seq: ${nextSequence})`);
    
    // 4. Create member contributions
    console.log('👥 Creating member contributions...');
    
    const baseContribution = group.monthlyContribution || 500;
    const memberContributions = group.memberships.map(membership => ({
      groupPeriodicRecordId: nextPeriod.id,
      memberId: membership.memberId,
      compulsoryContributionDue: baseContribution,
      loanInterestDue: 0,
      minimumDueAmount: baseContribution,
      dueDate: nextPeriodDate,
      status: 'PENDING',
      compulsoryContributionPaid: 0,
      loanInterestPaid: 0,
      lateFinePaid: 0,
      totalPaid: 0,
      remainingAmount: baseContribution,
      daysLate: 0,
      lateFineAmount: 0,
    }));
    
    await prisma.memberContribution.createMany({
      data: memberContributions
    });
    
    console.log(`✅ Created ${memberContributions.length} member contributions`);
    
    // 5. Verify final state
    console.log('\n🔍 3. Final verification:');
    const finalPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' }
    });
    
    finalPeriods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      
      console.log(`  ${index + 1}. ${month} (Seq: ${period.recordSequenceNumber}) - ${status}`);
    });
    
    console.log('\n🎉 SUCCESS! Frontend should now show the correct current period');
    console.log('🌐 Try the frontend:');
    console.log('   http://localhost:3000/groups/68499d8a8ebb724c0ebedf0d/contributions');
    console.log('✨ From now on, when you close periods, the API will automatically');
    console.log('   create the next period, so this issue will not happen again!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createProperNextPeriod().catch(console.error);
