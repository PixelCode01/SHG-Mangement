const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAugustPeriod() {
  console.log('🛠️  Creating August period for proper frontend display...\n');
  
  const groupId = '68499d8a8ebb724c0ebedf0d';
  
  try {
    // 1. Check current state
    console.log('📊 1. Checking current state...');
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' },
      include: { memberContributions: true }
    });
    
    console.log(`Found ${periods.length} periods:`);
    periods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      
      console.log(`  ${index + 1}. ${month} (Seq: ${period.recordSequenceNumber}) - ${status}`);
    });
    
    // 2. Get latest period to base August on
    const latestPeriod = periods[periods.length - 1];
    const latestSequence = latestPeriod.recordSequenceNumber || 0;
    const nextSequence = latestSequence + 1;
    
    console.log(`\n📅 2. Creating August period with sequence ${nextSequence}...`);
    
    // 3. Check if August period already exists
    const augustDate = new Date(2025, 7, 10); // August 10, 2025 (month is 0-indexed)
    const existingAugust = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId,
        meetingDate: {
          gte: new Date(2025, 7, 1),  // August 1, 2025
          lt: new Date(2025, 8, 1)    // September 1, 2025
        }
      }
    });
    
    if (existingAugust) {
      console.log('❌ August period already exists:', existingAugust.id);
      console.log('   This means the issue is elsewhere');
      return;
    }
    
    // 4. Get group info for member contributions
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: { member: true }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`👥 Group has ${group.memberships.length} members`);
    
    // 5. Create August period
    console.log('🔨 Creating August period...');
    
    const augustPeriod = await prisma.groupPeriodicRecord.create({
      data: {
        groupId,
        meetingDate: augustDate,
        recordSequenceNumber: nextSequence,
        totalCollectionThisPeriod: null, // Mark as open
        standingAtStartOfPeriod: latestPeriod.totalGroupStandingAtEndOfPeriod || 0,
        totalGroupStandingAtEndOfPeriod: 0,
        interestEarnedThisPeriod: null,
        lateFinesCollectedThisPeriod: null,
        newContributionsThisPeriod: null,
        cashInHandAtEndOfPeriod: latestPeriod.cashInHandAtEndOfPeriod || 0,
        cashInBankAtEndOfPeriod: latestPeriod.cashInBankAtEndOfPeriod || 0,
        membersPresent: 0
      }
    });
    
    console.log(`✅ Created August period: ${augustPeriod.id}`);
    
    // 6. Create member contributions for August
    console.log('👥 Creating member contributions for August...');
    
    const baseContribution = group.monthlyContribution || 500;
    const augustContributions = [];
    
    for (const membership of group.memberships) {
      augustContributions.push({
        groupPeriodicRecordId: augustPeriod.id,
        memberId: membership.memberId,
        compulsoryContributionDue: baseContribution,
        loanInterestDue: 0, // Will be calculated based on loans if any
        minimumDueAmount: baseContribution,
        dueDate: augustDate,
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
    
    if (augustContributions.length > 0) {
      await prisma.memberContribution.createMany({
        data: augustContributions
      });
      
      console.log(`✅ Created ${augustContributions.length} member contributions for August`);
    }
    
    // 7. Verify the fix
    console.log('\n🔍 3. Verifying the fix...');
    
    const updatedPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' }
    });
    
    console.log('Updated periods:');
    updatedPeriods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      
      console.log(`  ${index + 1}. ${month} (Seq: ${period.recordSequenceNumber}) - ${status}`);
    });
    
    // Check current period API logic
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: 0 }
        ]
      },
      orderBy: [
        { recordSequenceNumber: 'desc' },
        { meetingDate: 'desc' }
      ]
    });
    
    if (currentPeriod) {
      const date = new Date(currentPeriod.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`\n✅ Current period API will now return: ${month} (Seq: ${currentPeriod.recordSequenceNumber})`);
      
      if (month.includes('August')) {
        console.log('🎉 SUCCESS! Frontend should now show August as current period');
        console.log('\n🌐 Try refreshing the frontend page:');
        console.log('   http://localhost:3000/groups/68499d8a8ebb724c0ebedf0d/contributions');
      } else {
        console.log(`❌ Still showing ${month} - needs further investigation`);
      }
    } else {
      console.log('❌ No current period found after fix');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAugustPeriod().catch(console.error);
