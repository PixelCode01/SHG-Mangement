const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosingDirect() {
  console.log('🧪 Testing period     const closedPeriod = await prisma.groupPeriodicRecord.findUnique({
      where: { id: periodId }
    });

    const newOpenPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: groupId,
        totalCollectionThisPeriod: null
      }
    });

    console.log(`📊 Verification:
      - Closed period collection: ₹${closedPeriod.totalCollectionThisPeriod}
      - Closed period bank balance: ₹${closedPeriod.cashInBankAtEndOfPeriod}
      - New open period: ${newOpenPeriod ? newOpenPeriod.id : 'Not found'}
      - New period sequence: ${newOpenPeriod ? newOpenPeriod.recordSequenceNumber : 'N/A'}`);}rectly (bypassing API auth)...\n');

  try {
    // Find the current open period
    const openPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        totalCollectionThisPeriod: null
      },
      include: {
        group: true,
        memberContributions: {
          include: {
            member: true
          }
        }
      }
    });

    if (!openPeriod) {
      console.log('❌ No open period found');
      return;
    }

    console.log(`📊 Found open period:
      - Period ID: ${openPeriod.id}
      - Group: ${openPeriod.group.name} (${openPeriod.group.id})
      - Sequence: ${openPeriod.recordSequenceNumber}
      - Member Contributions: ${openPeriod.memberContributions.length}`);

    // Calculate current totals
    const paidContributions = openPeriod.memberContributions.filter(c => c.totalPaid > 0);
    const totalCollection = openPeriod.memberContributions
      .filter(c => c.totalPaid > 0)
      .reduce((sum, c) => sum + c.totalPaid, 0);

    console.log(`💰 Current Status:
      - Paid Contributions: ${paidContributions.length}/${openPeriod.memberContributions.length}
      - Total Collection: ₹${totalCollection}`);

    // Simulate the period closing logic
    const groupId = openPeriod.group.id;
    const periodId = openPeriod.id;

    console.log('\n🚀 Starting period closing simulation...');
    
    const startTime = Date.now();

    // Step 1: Calculate group financial standing
    console.log('📊 Calculating group financial standing...');
    
    const previousPeriods = await prisma.groupPeriodicRecord.findMany({
      where: {
        groupId: groupId,
        recordSequenceNumber: { lt: openPeriod.recordSequenceNumber },
        totalCollectionThisPeriod: { not: null }
      },
      orderBy: { recordSequenceNumber: 'desc' }
    });

    const previousPeriod = previousPeriods[0];
    
    // Calculate total loan assets
    const activeLoans = await prisma.loan.findMany({
      where: {
        groupId: groupId,
        status: 'ACTIVE'
      }
    });

    const totalLoanAssets = activeLoans.reduce((sum, loan) => sum + loan.currentOutstandingAmount, 0);

    // Group standing calculation
    const bankBalance = previousPeriod?.cashInBankAtEndOfPeriod || 0;
    const cashInHand = previousPeriod?.cashInHandAtEndOfPeriod || 0;
    const previousLoanAssets = previousPeriod?.totalLoanAssets || 0;
    
    const newBankBalance = bankBalance + totalCollection;
    const newCashInHand = cashInHand;
    const newLoanAssets = totalLoanAssets;
    
    console.log(`💰 Financial Standing Calculation:
      Previous: Bank ₹${bankBalance}, Cash ₹${cashInHand}, Loans ₹${previousLoanAssets}
      Current Collection: ₹${totalCollection}
      New: Bank ₹${newBankBalance}, Cash ₹${newCashInHand}, Loans ₹${newLoanAssets}
      Total Assets: ₹${newBankBalance + newCashInHand + newLoanAssets}`);

    // Step 2: Begin transaction simulation
    console.log('\n🔄 Starting main transaction...');
    
    await prisma.$transaction(async (tx) => {
      // Close current period
      console.log('📝 Closing current period...');
      await tx.groupPeriodicRecord.update({
        where: { id: periodId },
        data: {
          totalCollectionThisPeriod: totalCollection,
          cashInBankAtEndOfPeriod: newBankBalance,
          cashInHandAtEndOfPeriod: newCashInHand,
          totalLoanAssets: newLoanAssets,
          totalGroupStandingAtEndOfPeriod: newBankBalance + newCashInHand + newLoanAssets
        }
      });

      // Create next period
      console.log('📝 Creating next period...');
      const nextSequence = openPeriod.recordSequenceNumber + 1;
      
      const nextPeriod = await tx.groupPeriodicRecord.create({
        data: {
          groupId: groupId,
          recordSequenceNumber: nextSequence,
          meetingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          totalCollectionThisPeriod: null,
          standingAtStartOfPeriod: newBankBalance + newCashInHand + newLoanAssets,
          cashInBankAtEndOfPeriod: newBankBalance,
          cashInHandAtEndOfPeriod: newCashInHand,
          totalGroupStandingAtEndOfPeriod: newBankBalance + newCashInHand + newLoanAssets,
          totalLoanAssets: newLoanAssets
        }
      });

      console.log(`✅ Created next period: ${nextPeriod.id} (sequence ${nextSequence})`);
    });

    // Step 3: Update member contributions in batches (outside main transaction)
    console.log('\n🔄 Updating member contributions in batches...');
    
    const batchSize = 5;
    const memberContributions = openPeriod.memberContributions;
    
    for (let i = 0; i < memberContributions.length; i += batchSize) {
      const batch = memberContributions.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(memberContributions.length / batchSize)} (${batch.length} members)`);
      
      await prisma.$transaction(async (tx) => {
        for (const contribution of batch) {
          if (contribution.totalPaid > 0) {
            await tx.groupMemberPeriodicRecord.update({
              where: { id: contribution.id },
              data: { 
                status: 'PAID'
              }
            });
          }
        }
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n✅ Period closing simulation completed successfully!
      - Duration: ${duration}ms
      - No transaction timeouts
      - All member contributions updated in batches`);

    // Verify the results
    console.log('\n🔍 Verifying results...');
    
    const closedPeriod = await prisma.periodicRecord.findUnique({
      where: { id: periodId }
    });

    const newOpenPeriod = await prisma.periodicRecord.findFirst({
      where: {
        groupId: groupId,
        totalCollectionThisPeriod: null
      }
    });

    console.log(`📊 Verification:
      - Closed period collection: ₹${closedPeriod.totalCollectionThisPeriod}
      - Closed period bank balance: ₹${closedPeriod.groupBankBalance}
      - New open period: ${newOpenPeriod ? newOpenPeriod.id : 'Not found'}
      - New period sequence: ${newOpenPeriod ? newOpenPeriod.sequenceNumber : 'N/A'}`);

  } catch (error) {
    console.error('❌ Error during period closing test:', error);
    if (error.code === 'P2028') {
      console.error('🔥 Transaction timeout detected - this should not happen with the fix!');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodClosingDirect().catch(console.error);
