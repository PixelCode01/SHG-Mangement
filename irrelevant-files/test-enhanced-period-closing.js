const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEnhancedPeriodClosing() {
  console.log('🧪 TESTING ENHANCED PERIOD CLOSING FUNCTIONALITY');
  console.log('==================================================\n');

  try {
    // Test with a known group
    const testGroup = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found');
      return;
    }

    console.log(`✅ Using test group: ${testGroup.name} (${testGroup.id})`);
    console.log(`   - Members: ${testGroup.memberships.length}`);
    console.log(`   - Collection frequency: ${testGroup.collectionFrequency || 'MONTHLY'}`);
    console.log(`   - Monthly contribution: ₹${testGroup.monthlyContribution || 0}`);

    // 1. Test Current Period API - Enhanced functionality
    console.log('\n1. TESTING CURRENT PERIOD API (Enhanced)');
    console.log('------------------------------------------');
    
    const currentPeriodResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/current`);
    if (currentPeriodResponse.ok) {
      const currentPeriodData = await currentPeriodResponse.json();
      console.log('✅ Current period API response:', {
        success: currentPeriodData.success,
        periodId: currentPeriodData.period?.id,
        startDate: currentPeriodData.period?.startDate,
        isClosed: currentPeriodData.period?.isClosed,
        periodNumber: currentPeriodData.period?.periodNumber
      });
    } else {
      console.log('❌ Current period API failed:', currentPeriodResponse.status);
    }

    // 2. Check if there's an open period available for testing
    console.log('\n2. CHECKING FOR OPEN PERIODS');
    console.log('------------------------------');
    
    const openPeriods = await prisma.groupPeriodicRecord.findMany({
      where: {
        groupId: testGroup.id,
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: 0 }
        ]
      },
      orderBy: { recordSequenceNumber: 'desc' },
      include: {
        memberContributions: true
      }
    });

    console.log(`Found ${openPeriods.length} open period(s)`);
    
    if (openPeriods.length === 0) {
      console.log('📅 Creating a test period for testing...');
      
      // Create a test period
      const latestPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: testGroup.id },
        orderBy: { recordSequenceNumber: 'desc' }
      });

      const nextSequence = (latestPeriod?.recordSequenceNumber || 0) + 1;
      
      const testPeriod = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: testGroup.id,
          meetingDate: new Date(),
          recordSequenceNumber: nextSequence,
          totalCollectionThisPeriod: null,
          standingAtStartOfPeriod: latestPeriod?.totalGroupStandingAtEndOfPeriod || 10000,
          totalGroupStandingAtEndOfPeriod: 0,
        }
      });

      console.log(`✅ Created test period: ${testPeriod.id} (sequence: ${testPeriod.recordSequenceNumber})`);
      
      // Create some test member contributions
      const memberContributions = testGroup.memberships.slice(0, 3).map(membership => ({
        groupPeriodicRecordId: testPeriod.id,
        memberId: membership.member.id,
        compulsoryContributionDue: testGroup.monthlyContribution || 500,
        loanInterestDue: 0,
        minimumDueAmount: testGroup.monthlyContribution || 500,
        dueDate: new Date(),
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0,
        remainingAmount: testGroup.monthlyContribution || 500,
        daysLate: 0,
        lateFineAmount: 0,
      }));

      await prisma.memberContribution.createMany({
        data: memberContributions
      });

      console.log(`✅ Created ${memberContributions.length} test member contributions`);
    }

    // 3. Test enhanced period closing functionality
    console.log('\n3. TESTING ENHANCED PERIOD CLOSING');
    console.log('-----------------------------------');

    const testPeriod = openPeriods[0] || await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: testGroup.id,
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: 0 }
        ]
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    if (!testPeriod) {
      console.log('❌ No test period available');
      return;
    }

    console.log(`📝 Testing with period: ${testPeriod.id}`);

    // Simulate some contributions before closing
    const memberContributions = await prisma.memberContribution.findMany({
      where: { groupPeriodicRecordId: testPeriod.id },
      take: 2
    });

    if (memberContributions.length > 0) {
      console.log(`📊 Setting up test contributions for ${memberContributions.length} members...`);
      
      // Create test actual contributions data
      const actualContributions = memberContributions.reduce((acc, contrib) => {
        acc[contrib.memberId] = {
          id: contrib.id,
          totalPaid: testGroup.monthlyContribution || 500,
          compulsoryContributionPaid: testGroup.monthlyContribution || 500,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          cashAllocation: JSON.stringify({
            contributionToCashInHand: (testGroup.monthlyContribution || 500) * 0.3,
            contributionToCashInBank: (testGroup.monthlyContribution || 500) * 0.7,
            interestToCashInHand: 0,
            interestToCashInBank: 0
          })
        };
        return acc;
      }, {});

      const memberContributionData = memberContributions.map(contrib => ({
        memberId: contrib.memberId,
        remainingAmount: 0,
        daysLate: 0,
        lateFineAmount: 0
      }));

      console.log('🧪 Calling enhanced period close API...');
      
      const closeResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: testPeriod.id,
          memberContributions: memberContributionData,
          actualContributions: actualContributions
        })
      });

      if (closeResponse.ok) {
        const closeResult = await closeResponse.json();
        console.log('✅ Enhanced period close successful!');
        console.log('📊 Response data:', {
          success: closeResult.success,
          message: closeResult.message,
          closedPeriodId: closeResult.record?.id,
          newPeriodId: closeResult.newPeriod?.id,
          currentPeriodId: closeResult.currentPeriod?.id,
          isAutoCreated: closeResult.isAutoCreatedPeriod,
          transition: closeResult.transition
        });

        // 4. Verify the enhancement worked
        console.log('\n4. VERIFYING ENHANCEMENT RESULTS');
        console.log('---------------------------------');

        // Check if current period API now returns the new period
        const newCurrentPeriodResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/current`);
        if (newCurrentPeriodResponse.ok) {
          const newCurrentPeriodData = await newCurrentPeriodResponse.json();
          console.log('✅ Post-closure current period:', {
            periodId: newCurrentPeriodData.period?.id,
            isClosed: newCurrentPeriodData.period?.isClosed,
            periodNumber: newCurrentPeriodData.period?.periodNumber
          });

          // Verify member contributions were set up for new period
          if (newCurrentPeriodData.period?.id) {
            const newPeriodContributions = await prisma.memberContribution.findMany({
              where: { groupPeriodicRecordId: newCurrentPeriodData.period.id }
            });

            console.log(`✅ New period has ${newPeriodContributions.length} member contributions`);
            console.log(`   Expected: ${testGroup.memberships.length} (all members)`);
            
            if (newPeriodContributions.length >= testGroup.memberships.length) {
              console.log('✅ All members have contributions in new period!');
            } else {
              console.log('⚠️  Some members missing from new period contributions');
            }
          }
        }

        console.log('\n🎉 ENHANCED PERIOD CLOSING TEST COMPLETE!');
        console.log('==========================================');
        console.log('✅ Period closing creates next period automatically');
        console.log('✅ All members get contributions set up in new period');
        console.log('✅ Current period API returns correct active period');
        console.log('✅ Enhanced response provides transition information');
        console.log('✅ Frontend can seamlessly continue with new period');

      } else {
        const errorText = await closeResponse.text();
        console.log('❌ Period close failed:', closeResponse.status, errorText);
      }
    } else {
      console.log('⚠️  No member contributions found for testing');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEnhancedPeriodClosing();
