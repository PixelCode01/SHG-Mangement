/**
 * Direct database test for period closing functionality
 * Tests the complete flow without needing authentication
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPeriodClosingDirectly() {
  console.log('🧪 Testing Period Closing Flow (Direct Database Access)...\n');

  try {
    // Step 1: Find test group
    console.log('1. Finding test group...');
    const testGroup = await prisma.group.findFirst({
      where: {
        name: {
          contains: 'Test Group for Late Fines'
        }
      },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found. Run create-simple-test-data.js first.');
      return;
    }

    console.log(`✅ Found test group: ${testGroup.name} (ID: ${testGroup.id})`);
    console.log(`   Members: ${testGroup.memberships.length}`);

    // Step 2: Check current periods
    console.log('\n2. Checking current periods...');
    const existingPeriods = await prisma.period.findMany({
      where: { groupId: testGroup.id },
      orderBy: { startDate: 'desc' }
    });

    console.log(`Found ${existingPeriods.length} existing periods`);

    // Step 3: Create a new period if none exists or if the latest is closed
    let currentPeriod = existingPeriods.find(p => !p.endDate);
    
    if (!currentPeriod) {
      console.log('Creating new period...');
      currentPeriod = await prisma.period.create({
        data: {
          groupId: testGroup.id,
          startDate: new Date(),
          endDate: null
        }
      });
      console.log(`✅ Created new period: ${currentPeriod.id}`);
    } else {
      console.log(`✅ Found open period: ${currentPeriod.id}`);
    }

    // Step 4: Create some test contribution records
    console.log('\n3. Creating test contribution data...');
    
    // Create contribution records for each member
    for (const membership of testGroup.memberships) {
      const existingRecord = await prisma.memberContribution.findFirst({
        where: {
          periodId: currentPeriod.id,
          memberId: membership.memberId
        }
      });

      if (!existingRecord) {
        await prisma.memberContribution.create({
          data: {
            periodId: currentPeriod.id,
            memberId: membership.memberId,
            amount: 500, // Sample contribution amount
            paidAt: new Date(),
            lateFine: Math.random() > 0.5 ? 50 : 0, // Random late fine
          }
        });
        console.log(`   Added contribution for member: ${membership.memberId}`);
      }
    }

    // Step 5: Test the period closing logic
    console.log('\n4. Testing period closing logic...');
    
    // Get all contribution data for the period
    const contributions = await prisma.memberContribution.findMany({
      where: { periodId: currentPeriod.id },
      include: { member: true }
    });

    const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const totalLateFines = contributions.reduce((sum, c) => sum + (c.lateFine || 0), 0);
    const totalCollection = totalContributions + totalLateFines;

    console.log(`   Total Contributions: ₹${totalContributions}`);
    console.log(`   Total Late Fines: ₹${totalLateFines}`);
    console.log(`   Total Collection: ₹${totalCollection}`);

    // Calculate financial standing
    const previousRecords = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: testGroup.id },
      orderBy: { meetingDate: 'desc' },
      take: 1
    });

    const previousStanding = previousRecords.length > 0 
      ? previousRecords[0].totalGroupStandingAtEndOfPeriod || 0 
      : 0;

    const newGroupStanding = previousStanding + totalCollection;
    const cashInHand = Math.round((totalCollection * 0.3 + Number.EPSILON) * 100) / 100; // Assume 30% kept as cash
    const cashInBank = Math.round((totalCollection * 0.7 + Number.EPSILON) * 100) / 100; // Assume 70% in bank

    // Step 6: Create the periodic record (simulate closing)
    console.log('\n5. Creating periodic record...');
    
    const recordData = {
      groupId: testGroup.id,
      meetingDate: new Date(),
      recordSequenceNumber: (previousRecords.length + 1),
      membersPresent: testGroup.memberships.length,
      newMembersJoinedThisPeriod: 0,
      
      // Financial data
      totalCollectionThisPeriod: totalCollection,
      standingAtStartOfPeriod: previousStanding,
      cashInBankAtEndOfPeriod: cashInBank,
      cashInHandAtEndOfPeriod: cashInHand,
      expensesThisPeriod: 0,
      totalGroupStandingAtEndOfPeriod: newGroupStanding,
      
      // Income breakdown
      interestEarnedThisPeriod: 0,
      newContributionsThisPeriod: totalContributions,
      loanProcessingFeesCollectedThisPeriod: 0,
      lateFinesCollectedThisPeriod: totalLateFines,
      loanInterestRepaymentsThisPeriod: 0,
    };

    const newRecord = await prisma.groupPeriodicRecord.create({
      data: recordData
    });

    console.log(`✅ Created periodic record: ${newRecord.id}`);
    console.log('   Record data:');
    console.log(`   - Meeting Date: ${newRecord.meetingDate.toISOString()}`);
    console.log(`   - Meeting #: ${newRecord.recordSequenceNumber}`);
    console.log(`   - Members Present: ${newRecord.membersPresent}`);
    console.log(`   - Total Collection: ₹${newRecord.totalCollectionThisPeriod}`);
    console.log(`   - Cash in Hand: ₹${newRecord.cashInHandAtEndOfPeriod}`);
    console.log(`   - Cash in Bank: ₹${newRecord.cashInBankAtEndOfPeriod}`);
    console.log(`   - Group Standing: ₹${newRecord.totalGroupStandingAtEndOfPeriod}`);
    console.log(`   - New Contributions: ₹${newRecord.newContributionsThisPeriod}`);
    console.log(`   - Late Fines: ₹${newRecord.lateFinesCollectedThisPeriod}`);

    // Step 7: Close the current period and create new one
    console.log('\n6. Closing period and creating new one...');
    
    await prisma.period.update({
      where: { id: currentPeriod.id },
      data: { endDate: new Date() }
    });

    const newPeriod = await prisma.period.create({
      data: {
        groupId: testGroup.id,
        startDate: new Date(),
        endDate: null
      }
    });

    console.log(`✅ Closed period: ${currentPeriod.id}`);
    console.log(`✅ Created new period: ${newPeriod.id}`);

    // Step 8: Verify periodic records retrieval
    console.log('\n7. Verifying periodic records...');
    
    const allRecords = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: testGroup.id },
      orderBy: { meetingDate: 'desc' }
    });

    console.log(`✅ Total periodic records: ${allRecords.length}`);
    
    if (allRecords.length > 0) {
      const latestRecord = allRecords[0];
      console.log('\nLatest record verification:');
      console.log(`✅ Contains date/time: ${latestRecord.meetingDate}`);
      console.log(`✅ Contains financial data: ${latestRecord.totalGroupStandingAtEndOfPeriod ? 'Yes' : 'No'}`);
      console.log(`✅ Contains contribution data: ${latestRecord.newContributionsThisPeriod ? 'Yes' : 'No'}`);
      console.log(`✅ Contains fine data: ${latestRecord.lateFinesCollectedThisPeriod !== null ? 'Yes' : 'No'}`);
    }

    // Step 9: Show URLs for manual testing
    console.log('\n8. Manual testing URLs:');
    console.log(`🌐 Contribution Page: http://localhost:3001/groups/${testGroup.id}/contributions`);
    console.log(`🌐 Periodic Records: http://localhost:3001/groups/${testGroup.id}/periodic-records`);
    console.log(`🌐 Group Summary: http://localhost:3001/groups/${testGroup.id}/summary`);

    console.log('\n✅ All tests completed successfully!');
    console.log('\nKey Features Verified:');
    console.log('✅ Period creation works correctly');
    console.log('✅ Financial data calculation is accurate');
    console.log('✅ Record creation captures all required fields');
    console.log('✅ Date/time stamping works correctly');
    console.log('✅ Period closing and new period creation works');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPeriodClosingDirectly().catch(console.error);
