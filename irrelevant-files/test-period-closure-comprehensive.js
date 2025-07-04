const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosureComprehensive() {
  try {
    console.log('=== COMPREHENSIVE PERIOD CLOSURE TEST ===\n');

    // Step 1: Check current state
    console.log('📊 STEP 1: Current Database State');
    console.log('═'.repeat(50));
    
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      orderBy: { recordSequenceNumber: 'asc' },
      include: {
        memberContributions: {
          select: {
            id: true,
            memberId: true,
            status: true,
            totalPaid: true,
            remainingAmount: true
          }
        }
      }
    });

    console.log(`Found ${allPeriods.length} periods total\n`);
    
    allPeriods.forEach((period, idx) => {
      const timeSinceCreation = new Date() - period.createdAt;
      const timeSinceUpdate = new Date() - period.updatedAt;
      const isRecentlyCreated = timeSinceCreation < 300000; // 5 minutes
      const neverUpdated = Math.abs(period.createdAt.getTime() - period.updatedAt.getTime()) < 1000;
      const isAutoCreated = period.totalCollectionThisPeriod === 0 && (isRecentlyCreated || neverUpdated);
      
      console.log(`Period #${idx + 1}:`);
      console.log(`  - ID: ${period.id}`);
      console.log(`  - Sequence: ${period.recordSequenceNumber}`);
      console.log(`  - Meeting Date: ${period.meetingDate?.toLocaleDateString()}`);
      console.log(`  - Total Collection: ₹${period.totalCollectionThisPeriod || 0}`);
      console.log(`  - Auto-Created: ${isAutoCreated ? 'YES' : 'NO'}`);
      console.log(`  - Created: ${period.createdAt.toLocaleString()}`);
      console.log(`  - Updated: ${period.updatedAt.toLocaleString()}`);
      console.log(`  - Contributions: ${period.memberContributions.length}`);
      console.log('');
    });

    // Step 2: Test auto-created period detection logic
    console.log('🔍 STEP 2: Auto-Created Period Detection');
    console.log('═'.repeat(50));
    
    for (const period of allPeriods) {
      const timeSinceCreation = new Date() - period.createdAt;
      const timeSinceUpdate = new Date() - period.updatedAt;
      const isRecentlyCreated = timeSinceCreation < 300000; // 5 minutes
      const neverUpdated = Math.abs(period.createdAt.getTime() - period.updatedAt.getTime()) < 1000;
      const isAutoCreated = period.totalCollectionThisPeriod === 0 && (isRecentlyCreated || neverUpdated);
      
      console.log(`Period ${period.recordSequenceNumber}:`);
      console.log(`  - Total Collection: ${period.totalCollectionThisPeriod}`);
      console.log(`  - Time since creation: ${Math.round(timeSinceCreation / 1000)}s`);
      console.log(`  - Time since update: ${Math.round(timeSinceUpdate / 1000)}s`);
      console.log(`  - Recently created: ${isRecentlyCreated}`);
      console.log(`  - Never updated: ${neverUpdated}`);
      console.log(`  - Detected as auto-created: ${isAutoCreated}`);
      console.log('');
    }

    // Step 3: Simulate period closure on different types of periods
    console.log('🧪 STEP 3: Testing Period Closure Logic');
    console.log('═'.repeat(50));
    
    // Find a period that has contributions to test with
    const periodWithContributions = allPeriods.find(p => p.memberContributions.length > 0);
    
    if (periodWithContributions) {
      console.log(`Testing with period ${periodWithContributions.recordSequenceNumber} which has ${periodWithContributions.memberContributions.length} contributions`);
      
      // Check what would happen when closing this period
      const currentSequence = periodWithContributions.recordSequenceNumber || 0;
      const nextSequence = currentSequence + 1;
      
      // Look for existing next period
      const existingNextPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: {
          groupId: periodWithContributions.groupId,
          recordSequenceNumber: nextSequence
        }
      });
      
      console.log(`Current period sequence: ${currentSequence}`);
      console.log(`Next expected sequence: ${nextSequence}`);
      console.log(`Existing next period: ${existingNextPeriod ? 'YES' : 'NO'}`);
      
      if (existingNextPeriod) {
        const existingPeriodAge = new Date().getTime() - existingNextPeriod.createdAt.getTime();
        const isExistingAutoCreated = existingNextPeriod.totalCollectionThisPeriod === 0 && existingPeriodAge < 3600000;
        
        console.log(`Existing next period details:`);
        console.log(`  - ID: ${existingNextPeriod.id}`);
        console.log(`  - Total Collection: ₹${existingNextPeriod.totalCollectionThisPeriod}`);
        console.log(`  - Age: ${Math.round(existingPeriodAge / 1000)}s`);
        console.log(`  - Would be considered auto-created: ${isExistingAutoCreated}`);
        console.log(`  - Action: ${isExistingAutoCreated ? 'UPDATE existing' : 'SKIP creation'}`);
      } else {
        console.log(`  - Action: CREATE new period`);
      }
    }

    // Step 4: Check for any orphaned or problematic periods
    console.log('⚠️  STEP 4: Checking for Issues');
    console.log('═'.repeat(50));
    
    // Check for periods without contributions
    const periodsWithoutContributions = allPeriods.filter(p => p.memberContributions.length === 0);
    console.log(`Periods without contributions: ${periodsWithoutContributions.length}`);
    
    periodsWithoutContributions.forEach(period => {
      console.log(`  - Period ${period.recordSequenceNumber}: ${period.totalCollectionThisPeriod === 0 ? 'Likely auto-created' : 'Closed but no contributions'}`);
    });

    // Check for duplicate sequence numbers
    const sequenceNumbers = allPeriods.map(p => p.recordSequenceNumber).filter(s => s !== null);
    const duplicateSequences = sequenceNumbers.filter((seq, idx) => sequenceNumbers.indexOf(seq) !== idx);
    
    if (duplicateSequences.length > 0) {
      console.log(`⚠️  WARNING: Duplicate sequence numbers found: ${duplicateSequences.join(', ')}`);
    } else {
      console.log(`✅ No duplicate sequence numbers found`);
    }

    // Step 5: Test new period creation logic
    console.log('\n🏗️  STEP 5: Testing Next Period Logic');
    console.log('═'.repeat(50));
    
    const group = await prisma.group.findFirst();
    if (group) {
      console.log(`Group collection frequency: ${group.collectionFrequency || 'MONTHLY'}`);
      console.log(`Monthly contribution: ₹${group.monthlyContribution || 0}`);
      console.log(`Interest rate: ${group.interestRate || 0}%`);
      
      // Calculate what the next period date would be
      const today = new Date();
      let nextPeriodDate;
      
      switch (group.collectionFrequency || 'MONTHLY') {
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
      
      console.log(`Next period date would be: ${nextPeriodDate.toLocaleDateString()}`);
    }

    console.log('\n✅ COMPREHENSIVE TEST COMPLETED');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Error during comprehensive test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosureComprehensive();
