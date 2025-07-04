/**
 * Test script to verify cash balance calculation fixes
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCashBalanceFix() {
  console.log('🧪 Testing Cash Balance Calculation Fix...\n');

  try {
    const groupId = '683ad41a7b643449e12cd5b6'; // Group 'gd'
    
    // Get group data for first record scenario
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: { member: true }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 1,
          select: {
            cashInBankAtEndOfPeriod: true,
            cashInHandAtEndOfPeriod: true,
            totalGroupStandingAtEndOfPeriod: true,
            meetingDate: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`🏦 Initial Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`📋 Existing Records: ${group.groupPeriodicRecords.length}\n`);

    const isFirstRecord = group.groupPeriodicRecords.length === 0;
    
    // Test frontend calculation logic
    console.log('🔍 Frontend Cash Collection Calculation Test:\n');
    
    // Simulate form data
    const totalCollectionThisPeriod = 1000; // New contributions + fees
    const loanRepayments = 300; // Loan repayments from members
    
    console.log(`Input Data:`);
    console.log(`  💰 Total Collection This Period: ₹${totalCollectionThisPeriod}`);
    console.log(`  💳 Loan Repayments: ₹${loanRepayments}`);
    
    let startingCash = 0;
    let totalCashCollection = 0;
    
    if (isFirstRecord) {
      // First record scenario
      startingCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
      totalCashCollection = startingCash + totalCollectionThisPeriod + loanRepayments;
      
      console.log(`\n📈 First Record Calculation:`);
      console.log(`  Starting Cash: ₹${startingCash}`);
      console.log(`  + Collection: ₹${totalCollectionThisPeriod}`);
      console.log(`  + Loan Repayments: ₹${loanRepayments}`);
      console.log(`  = Total Cash Available: ₹${totalCashCollection}`);
      
    } else {
      // Subsequent record scenario
      const latestRecord = group.groupPeriodicRecords[0];
      startingCash = (latestRecord.cashInBankAtEndOfPeriod || 0) + (latestRecord.cashInHandAtEndOfPeriod || 0);
      totalCashCollection = startingCash + totalCollectionThisPeriod + loanRepayments;
      
      console.log(`\n📈 Subsequent Record Calculation:`);
      console.log(`  Previous Cash in Bank: ₹${latestRecord.cashInBankAtEndOfPeriod || 0}`);
      console.log(`  Previous Cash in Hand: ₹${latestRecord.cashInHandAtEndOfPeriod || 0}`);
      console.log(`  Starting Cash: ₹${startingCash}`);
      console.log(`  + Collection: ₹${totalCollectionThisPeriod}`);
      console.log(`  + Loan Repayments: ₹${loanRepayments}`);
      console.log(`  = Total Cash Available: ₹${totalCashCollection}`);
    }
    
    console.log(`\n💡 Expected Behavior:`);
    console.log(`When user allocates cash, they should see:`);
    console.log(`- Cash allocation total should equal: ₹${totalCashCollection}`);
    console.log(`- Auto-allocation (70% bank, 30% hand) should be:`);
    console.log(`  - Bank: ₹${Math.round((totalCashCollection * 0.7 + Number.EPSILON) * 100) / 100}`);
    console.log(`  - Hand: ₹${Math.round((totalCashCollection * 0.3 + Number.EPSILON) * 100) / 100}`);
    
    // Test backend calculation for comparison
    console.log(`\n🔧 Backend Calculation (for comparison):`);
    console.log(`The backend calculates available cash as:`);
    console.log(`Standing at start + inflows + loan repayments - expenses`);
    
    const standingAtStart = isFirstRecord 
      ? (group.cashInHand || 0) + (group.balanceInBank || 0) + group.memberships.reduce((sum, m) => sum + (m.currentLoanAmount || 0), 0)
      : (group.groupPeriodicRecords[0]?.totalGroupStandingAtEndOfPeriod || 0);
    
    const inflows = totalCollectionThisPeriod; // Simplified
    const expenses = 100; // Example expense
    const backendCashAvailable = standingAtStart + inflows + loanRepayments - expenses;
    
    console.log(`  Standing at start: ₹${standingAtStart}`);
    console.log(`  + Inflows: ₹${inflows}`);
    console.log(`  + Loan repayments: ₹${loanRepayments}`);
    console.log(`  - Expenses: ₹${expenses}`);
    console.log(`  = Backend Cash Available: ₹${backendCashAvailable}`);
    
    // Compare frontend vs backend
    const difference = totalCashCollection - expenses - backendCashAvailable;
    console.log(`\n⚖️ Comparison:`);
    console.log(`  Frontend (before expenses): ₹${totalCashCollection}`);
    console.log(`  Backend (after expenses): ₹${backendCashAvailable}`);
    console.log(`  Difference (should equal expenses): ₹${difference}`);
    
    if (Math.abs(difference - expenses) < 0.01) {
      console.log(`  ✅ Calculations are consistent!`);
    } else {
      console.log(`  ⚠️ There may be a calculation inconsistency`);
    }
    
    console.log(`\n📝 Key Fix Summary:`);
    console.log(`- Frontend now includes starting cash in totalCashCollection`);
    console.log(`- For first records: includes initial group cash`);
    console.log(`- For subsequent records: includes previous period's cash allocation`);
    console.log(`- This should resolve the "cash balance wrong" issue`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCashBalanceFix();
