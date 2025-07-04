const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugCashAllocation() {
  console.log('🔍 DEBUGGING CASH ALLOCATION DISCREPANCY');
  console.log('=========================================\n');

  try {
    const groupId = '68452639c89581172a565838'; // Group 'jbk'
    
    // Get the current period data
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          select: {
            id: true,
            memberId: true,
            totalPaid: true,
            cashAllocation: true,
            member: { select: { name: true } }
          }
        }
      }
    });

    if (!currentPeriod) {
      console.log('❌ No periods found');
      return;
    }

    console.log(`📋 Current Period: ${currentPeriod.meetingDate}`);
    console.log(`📊 Period ID: ${currentPeriod.id}`);
    console.log(`💰 Total Collection This Period: ₹${currentPeriod.totalCollectionThisPeriod}\n`);

    // Get group data
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        cashInHand: true,
        balanceInBank: true
      }
    });

    console.log(`📊 Group Starting Values:`);
    console.log(`  - Cash in Hand: ₹${group.cashInHand}`);
    console.log(`  - Cash in Bank: ₹${group.balanceInBank}\n`);

    // Analyze each member's cash allocation
    let totalCashToHand = 0;
    let totalCashToBank = 0;
    let totalContributions = 0;

    console.log(`👥 Member Cash Allocations:`);
    currentPeriod.memberContributions.forEach(contrib => {
      if (contrib.totalPaid > 0) {
        totalContributions += contrib.totalPaid;
        
        if (contrib.cashAllocation) {
          try {
            const allocation = JSON.parse(contrib.cashAllocation);
            const toHand = (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
            const toBank = (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
            
            totalCashToHand += toHand;
            totalCashToBank += toBank;
            
            console.log(`  📋 ${contrib.member.name}: Paid ₹${contrib.totalPaid}, Hand: ₹${toHand.toFixed(2)}, Bank: ₹${toBank.toFixed(2)}`);
          } catch (e) {
            console.log(`  ❌ ${contrib.member.name}: Error parsing allocation - ₹${contrib.totalPaid}`);
            // Use default allocation with rounding
            totalCashToHand += Math.round((contrib.totalPaid * 0.3 + Number.EPSILON) * 100) / 100;
            totalCashToBank += Math.round((contrib.totalPaid * 0.7 + Number.EPSILON) * 100) / 100;
          }
        } else {
          console.log(`  📋 ${contrib.member.name}: No allocation data - ₹${contrib.totalPaid} (using default 30/70)`);
          // Use default allocation with rounding
          totalCashToHand += Math.round((contrib.totalPaid * 0.3 + Number.EPSILON) * 100) / 100;
          totalCashToBank += Math.round((contrib.totalPaid * 0.7 + Number.EPSILON) * 100) / 100;
        }
      }
    });

    console.log(`\n📊 ALLOCATION SUMMARY:`);
    console.log(`  💰 Total Contributions: ₹${totalContributions}`);
    console.log(`  👋 Total to Cash in Hand: ₹${totalCashToHand.toFixed(2)}`);
    console.log(`  🏦 Total to Cash in Bank: ₹${totalCashToBank.toFixed(2)}`);
    console.log(`  ✅ Total Allocated: ₹${(totalCashToHand + totalCashToBank).toFixed(2)}`);

    console.log(`\n🎯 FRONTEND CALCULATION (Expected):`);
    const frontendCashInHand = group.cashInHand + totalCashToHand;
    const frontendCashInBank = group.balanceInBank + totalCashToBank;
    console.log(`  👋 Cash in Hand: ₹${group.cashInHand} + ₹${totalCashToHand.toFixed(2)} = ₹${frontendCashInHand.toFixed(2)}`);
    console.log(`  🏦 Cash in Bank: ₹${group.balanceInBank} + ₹${totalCashToBank.toFixed(2)} = ₹${frontendCashInBank.toFixed(2)}`);

    console.log(`\n🔍 BACKEND vs FRONTEND COMPARISON:`);
    console.log(`  Frontend Cash in Bank: ₹${frontendCashInBank.toFixed(2)}`);
    console.log(`  Expected (from screenshot): ₹23,523.6`);
    console.log(`  Difference: ₹${(23523.6 - frontendCashInBank).toFixed(2)}`);

    // Check what the backend calculated for the closed period
    const closedPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        totalCollectionThisPeriod: { gt: 0 } // Find a closed period
      },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        meetingDate: true,
        totalCollectionThisPeriod: true,
        cashInHandAtEndOfPeriod: true,
        cashInBankAtEndOfPeriod: true,
        totalGroupStandingAtEndOfPeriod: true
      }
    });

    if (closedPeriod) {
      console.log(`\n📋 LAST CLOSED PERIOD RECORD:`);
      console.log(`  📅 Date: ${closedPeriod.meetingDate}`);
      console.log(`  💰 Collection: ₹${closedPeriod.totalCollectionThisPeriod}`);
      console.log(`  👋 Cash in Hand (End): ₹${closedPeriod.cashInHandAtEndOfPeriod}`);
      console.log(`  🏦 Cash in Bank (End): ₹${closedPeriod.cashInBankAtEndOfPeriod}`);
      console.log(`  📈 Total Group Standing: ₹${closedPeriod.totalGroupStandingAtEndOfPeriod}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCashAllocation();
