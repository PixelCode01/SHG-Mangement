const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeGroupSpecificIssues() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔍 Analyzing Specific Group Issues...');
  console.log('====================================');
  console.log(`Group ID: ${groupId}`);

  try {
    // Get group details
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'asc' },
          include: {
            memberContributions: {
              include: {
                member: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`\n📊 GROUP DETAILS: ${group.name}`);
    console.log(`Current Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`Current Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`Total Current Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);

    // Check loan assets
    const membershipLoanAssets = await prisma.memberGroupMembership.aggregate({
      where: { groupId: groupId },
      _sum: { currentLoanAmount: true }
    });
    const totalLoanAssets = membershipLoanAssets._sum.currentLoanAmount || 0;
    console.log(`Total Loan Assets: ₹${totalLoanAssets}`);

    console.log(`\n📋 PERIODIC RECORDS ANALYSIS:`);
    console.log(`Found ${group.groupPeriodicRecords.length} periodic records`);

    group.groupPeriodicRecords.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Sequence: ${record.recordSequenceNumber}`);
      console.log(`  Meeting Date: ${record.meetingDate.toISOString().split('T')[0]}`);
      console.log(`  Cash in Hand: ₹${record.cashInHandAtEndOfPeriod || 0}`);
      console.log(`  Cash in Bank: ₹${record.cashInBankAtEndOfPeriod || 0}`);
      console.log(`  Total Standing: ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`  Starting Balance: ₹${record.standingAtStartOfPeriod || 0}`);
      console.log(`  Collection: ₹${record.totalCollectionThisPeriod || 0}`);
      console.log(`  Interest: ₹${record.interestEarnedThisPeriod || 0}`);
      console.log(`  Member Contributions: ${record.memberContributions.length}`);
      
      // Check if this record has been properly closed
      const isClosedPeriod = record.totalCollectionThisPeriod && record.totalCollectionThisPeriod > 0;
      console.log(`  Status: ${isClosedPeriod ? 'CLOSED' : 'OPEN/EMPTY'}`);
    });

    // Check for duplicate records
    console.log(`\n🔍 CHECKING FOR DUPLICATES:`);
    const duplicateSequences = {};
    const duplicateDates = {};

    group.groupPeriodicRecords.forEach(record => {
      const sequence = record.recordSequenceNumber;
      const dateStr = record.meetingDate.toISOString().split('T')[0];
      
      if (!duplicateSequences[sequence]) duplicateSequences[sequence] = [];
      if (!duplicateDates[dateStr]) duplicateDates[dateStr] = [];
      
      duplicateSequences[sequence].push(record.id);
      duplicateDates[dateStr].push(record.id);
    });

    Object.entries(duplicateSequences).forEach(([sequence, recordIds]) => {
      if (recordIds.length > 1) {
        console.log(`⚠️ Duplicate sequence ${sequence}: ${recordIds.length} records (${recordIds.join(', ')})`);
      }
    });

    Object.entries(duplicateDates).forEach(([date, recordIds]) => {
      if (recordIds.length > 1) {
        console.log(`⚠️ Duplicate date ${date}: ${recordIds.length} records (${recordIds.join(', ')})`);
      }
    });

    // Expected next period calculation
    const latestRecord = group.groupPeriodicRecords[group.groupPeriodicRecords.length - 1];
    if (latestRecord) {
      const nextSequence = (latestRecord.recordSequenceNumber || 0) + 1;
      const nextDate = new Date(latestRecord.meetingDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      console.log(`\n📅 EXPECTED NEXT PERIOD:`);
      console.log(`  Next Sequence: ${nextSequence}`);
      console.log(`  Next Date: ${nextDate.toISOString().split('T')[0]}`);
      console.log(`  Should be: August 2025`);
    }

    // Check what the current period should be based on closed periods
    const closedPeriods = group.groupPeriodicRecords.filter(r => 
      r.totalCollectionThisPeriod && r.totalCollectionThisPeriod > 0
    );
    console.log(`\n🔒 PERIOD STATUS:`);
    console.log(`  Total periods: ${group.groupPeriodicRecords.length}`);
    console.log(`  Closed periods: ${closedPeriods.length}`);
    console.log(`  Open periods: ${group.groupPeriodicRecords.length - closedPeriods.length}`);

    if (closedPeriods.length >= 2) {
      console.log(`  ✅ June and July should both be closed`);
      console.log(`  📊 Current period should be: August 2025`);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeGroupSpecificIssues()
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
