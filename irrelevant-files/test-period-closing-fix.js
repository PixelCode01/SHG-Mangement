const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodClosingFix() {
  try {
    console.log('🧪 Testing period closing fix (transaction timeout resolution)...\n');

    // Find an active period with contributions (we'll just get the first period and check if it's open)
    const activePeriod = await prisma.groupPeriodicRecord.findFirst({
      include: {
        group: {
          select: {
            id: true,
            name: true,
            balanceInBank: true,
            cashInHand: true,
            monthlyContribution: true,
            interestRate: true,
            collectionFrequency: true
          }
        },
        memberContributions: true
      }
    });

    // Check if the period is actually open (not closed)
    if (activePeriod && activePeriod.totalCollectionThisPeriod !== null) {
      console.log('❌ Found period but it\'s already closed.');
      console.log(`   Collection: ₹${activePeriod.totalCollectionThisPeriod}`);
      return;
    }

    if (!activePeriod) {
      console.log('❌ No active period found.');
      return;
    }

    const groupId = activePeriod.group.id;
    const periodId = activePeriod.id;
    
    console.log(`📊 Found active period:
      - Period ID: ${periodId}
      - Group: ${activePeriod.group.name} (${groupId})
      - Sequence: ${activePeriod.recordSequenceNumber}
      - Member Contributions: ${activePeriod.memberContributions.length}
      - Group Balance: ₹${activePeriod.group.balanceInBank || 0}
      - Cash in Hand: ₹${activePeriod.group.cashInHand || 0}\n`);

    // Check if any contributions are paid
    const paidContributions = activePeriod.memberContributions.filter(mc => mc.status === 'PAID');
    const totalPaid = paidContributions.reduce((sum, mc) => sum + (mc.totalPaid || 0), 0);
    
    console.log(`💰 Payment Status:
      - Paid Contributions: ${paidContributions.length}/${activePeriod.memberContributions.length}
      - Total Collection: ₹${totalPaid}\n`);

    if (paidContributions.length === 0) {
      console.log('⚠️  No contributions are marked as paid. Marking some as paid for testing...');
      
      // Mark first few contributions as paid for testing
      const contributionsToMark = activePeriod.memberContributions.slice(0, Math.min(3, activePeriod.memberContributions.length));
      
      for (const contrib of contributionsToMark) {
        const amountToPay = contrib.minimumDueAmount || contrib.compulsoryContributionDue || 1000;
        await prisma.memberContribution.update({
          where: { id: contrib.id },
          data: {
            status: 'PAID',
            compulsoryContributionPaid: amountToPay,
            totalPaid: amountToPay,
            remainingAmount: 0
          }
        });
      }
      
      console.log(`✅ Marked ${contributionsToMark.length} contributions as paid\n`);
    }

    // Now test the period closing API
    console.log('🚀 Testing period closing API...');
    const startTime = Date.now();
    
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}/contributions/periods/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  API Response Time: ${duration}ms`);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.log(`❌ API Error (${response.status}): ${errorData}`);
      
      if (response.status === 500 && errorData.includes('timeout')) {
        console.log('❌ Transaction timeout still occurring!');
        console.log('💡 The fix may need further optimization.');
      }
      
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Period closed successfully!');
      console.log(`📋 Results:
        - Closed Period: ${result.closedPeriod.id}
        - New Period: ${result.newPeriod.id}
        - Duration: ${duration}ms\n`);
      
      // Verify the closed period
      const closedPeriod = await prisma.groupPeriodicRecord.findUnique({
        where: { id: result.closedPeriod.id }
      });
      
      console.log(`🔍 Verified Closed Period:
        - Status: ${closedPeriod.status}
        - Total Collection: ₹${closedPeriod.totalCollectionThisPeriod || 0}
        - Cash in Bank: ₹${closedPeriod.cashInBankAtEndOfPeriod || 0}
        - Group Standing: ₹${closedPeriod.totalGroupStandingAtEndOfPeriod || 0}\n`);
      
      // Verify the new period
      const newPeriod = await prisma.groupPeriodicRecord.findUnique({
        where: { id: result.newPeriod.id },
        include: {
          memberContributions: true
        }
      });
      
      console.log(`🆕 Verified New Period:
        - Sequence: ${newPeriod.recordSequenceNumber}
        - Starting Standing: ₹${newPeriod.standingAtStartOfPeriod || 0}
        - Member Contributions: ${newPeriod.memberContributions.length}
        - Status: Active\n`);
      
      console.log('✅ Period closing fix verification completed successfully!');
      console.log('🎉 Transaction timeout issue has been resolved!');
      
    } else {
      console.log(`❌ Period closing failed: ${result.message || result.error}`);
      
      if (result.alreadyClosed) {
        console.log('ℹ️  Period was already closed (this is expected behavior)');
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure the development server is running (npm run dev)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPeriodClosingFix().catch(console.error);
