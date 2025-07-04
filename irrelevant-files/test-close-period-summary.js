#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testClosePeriodSummary() {
  try {
    console.log('🧪 TESTING CLOSE PERIOD FINANCIAL SUMMARY');
    console.log('==========================================');

    // 1. Find our test group with contributions
    const group = await prisma.group.findFirst({
      where: { name: 'Test Financial Group' },
      include: {
        memberships: {
          include: { member: { include: { users: true } } }
        }
      }
    });

    if (!group) {
      console.log('❌ Test group not found. Please run test-group-with-financial-data.js first');
      return;
    }

    console.log(`✅ Found group: ${group.name}`);
    console.log(`   📊 Initial Financial State:`);
    console.log(`      - Cash in Hand: ₹${group.cashInHand}`);
    console.log(`      - Cash in Bank: ₹${group.balanceInBank}`);

    // 2. Get the latest periodic record
    const latestRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId: group.id },
      orderBy: { createdAt: 'desc' },
      include: {
        memberContributions: {
          include: { member: true }
        }
      }
    });

    if (!latestRecord) {
      console.log('❌ No periodic record found. Please run test-contribution-dynamic-updates.js first');
      return;
    }

    console.log(`\n✅ Found periodic record with ${latestRecord.memberContributions.length} contributions`);

    // 3. Calculate totals for display
    const totalCollected = latestRecord.memberContributions.reduce((sum, c) => sum + c.totalPaid, 0);
    const contributionsWithAllocations = latestRecord.memberContributions.filter(c => c.cashAllocation);
    
    let totalCashToHand = 0;
    let totalCashToBank = 0;
    
    contributionsWithAllocations.forEach(c => {
      if (c.cashAllocation) {
        const allocation = JSON.parse(c.cashAllocation);
        totalCashToHand += (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
        totalCashToBank += (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
      }
    });

    console.log(`\n📊 PERIOD FINANCIAL SUMMARY:`);
    console.log(`   💰 Starting Values:`);
    console.log(`      - Cash in Hand: ₹${group.cashInHand}`);
    console.log(`      - Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`      - Group Standing: ₹${latestRecord.standingAtStartOfPeriod || (group.cashInHand + group.balanceInBank + 6000)}`);
    
    console.log(`\n   📈 This Period Activity:`);
    console.log(`      - Total Collection: ₹${totalCollected}`);
    console.log(`      - Allocated to Cash in Hand: ₹${totalCashToHand.toFixed(2)}`);
    console.log(`      - Allocated to Cash in Bank: ₹${totalCashToBank.toFixed(2)}`);
    
    const endingCashInHand = group.cashInHand + totalCashToHand;
    const endingCashInBank = group.balanceInBank + totalCashToBank;
    const endingGroupStanding = endingCashInHand + endingCashInBank + 6000; // Include loan assets
    
    console.log(`\n   💼 Ending Values:`);
    console.log(`      - Cash in Hand: ₹${endingCashInHand.toFixed(2)}`);
    console.log(`      - Cash in Bank: ₹${endingCashInBank.toFixed(2)}`);
    console.log(`      - Group Standing: ₹${endingGroupStanding.toFixed(2)}`);
    
    console.log(`\n🎯 CLOSE PERIOD SUMMARY TEST COMPLETE!`);
    console.log(`\nIn the UI, when you click "Close Period", you should see:`);
    console.log(`1. Starting values: Hand ₹${group.cashInHand}, Bank ₹${group.balanceInBank}, Standing ₹${latestRecord.standingAtStartOfPeriod || (group.cashInHand + group.balanceInBank + 6000)}`);
    console.log(`2. Period activity: Collection ₹${totalCollected}, Interest ₹0 (for now)`);
    console.log(`3. Ending values: Hand ₹${endingCashInHand.toFixed(2)}, Bank ₹${endingCashInBank.toFixed(2)}, Standing ₹${endingGroupStanding.toFixed(2)}`);
    console.log(`4. Detailed cash allocation breakdown`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClosePeriodSummary();
