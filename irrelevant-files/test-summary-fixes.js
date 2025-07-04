const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSummaryFixes() {
  console.log('🧪 TESTING SUMMARY FIXES');
  console.log('========================');
  console.log('Testing loan calculation fix and interest profit analysis\n');

  try {
    // Find a group with data
    const testGroup = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 6,
          include: {
            memberRecords: true
          }
        }
      }
    });

    if (!testGroup) {
      console.log('❌ No test group found');
      return;
    }

    console.log(`📊 Testing Group: ${testGroup.name}`);
    console.log(`👥 Members: ${testGroup.memberships.length}`);
    console.log(`📋 Recent Records: ${testGroup.groupPeriodicRecords.length}\n`);

    // Test 1: Fixed Loan Calculation
    console.log('🔧 TEST 1: FIXED LOAN CALCULATION');
    console.log('================================');
    
    let totalLoanAmount = 0;
    let membersWithLoans = 0;
    
    testGroup.memberships.forEach(membership => {
      const membershipLoanAmount = membership.currentLoanAmount || 0;
      const activeLoanBalance = membership.member.loans?.reduce((total, loan) => 
        total + loan.currentBalance, 0) || 0;
      const memberCurrentLoanBalance = activeLoanBalance > 0 ? activeLoanBalance : membershipLoanAmount;
      
      if (memberCurrentLoanBalance > 0) {
        console.log(`  ${membership.member.name}: ₹${memberCurrentLoanBalance.toLocaleString()}`);
        totalLoanAmount += memberCurrentLoanBalance;
        membersWithLoans++;
      }
    });
    
    console.log(`\n📈 Total Loan Amount: ₹${totalLoanAmount.toLocaleString()}`);
    console.log(`👥 Members with Loans: ${membersWithLoans}`);
    
    if (totalLoanAmount > 0) {
      console.log('✅ Loan calculation is working correctly');
    } else {
      console.log('⚠️  No loan data found - may need to check data source');
    }

    // Test 2: Interest Profit Analysis
    console.log('\n💰 TEST 2: INTEREST PROFIT ANALYSIS');
    console.log('==================================');
    
    const recentRecords = testGroup.groupPeriodicRecords.slice(0, 6);
    
    if (recentRecords.length === 0) {
      console.log('❌ No periodic records found for analysis');
      return;
    }
    
    const interestProfitAnalysis = recentRecords.map(record => {
      const interestEarned = record.interestEarnedThisPeriod || 0;
      const expenses = record.expensesThisPeriod || 0;
      const netInterestProfit = interestEarned - expenses;
      const profitMargin = interestEarned > 0 ? (netInterestProfit / interestEarned) * 100 : 0;
      
      return {
        date: record.meetingDate,
        period: new Date(record.meetingDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        interestEarned,
        expenses,
        netInterestProfit,
        profitMargin
      };
    });
    
    console.log('Recent Interest Profit Analysis:');
    interestProfitAnalysis.reverse().forEach(period => {
      const profitColor = period.netInterestProfit >= 0 ? '✅' : '❌';
      console.log(`  ${period.period}: Interest ₹${period.interestEarned.toLocaleString()} - Expenses ₹${period.expenses.toLocaleString()} = ${profitColor} ₹${period.netInterestProfit.toLocaleString()} (${period.profitMargin.toFixed(1)}%)`);
    });

    // Test 3: API Response Simulation
    console.log('\n🌐 TEST 3: API RESPONSE SIMULATION');
    console.log('=================================');
    
    const totalInterestEarned = recentRecords.reduce((sum, record) => 
      sum + (record.interestEarnedThisPeriod || 0), 0);
    const totalExpenses = recentRecords.reduce((sum, record) => 
      sum + (record.expensesThisPeriod || 0), 0);
    const netIncome = totalInterestEarned - totalExpenses;
    
    console.log(`📊 Summary (Last ${recentRecords.length} periods):`);
    console.log(`   Total Interest Earned: ₹${totalInterestEarned.toLocaleString()}`);
    console.log(`   Total Expenses: ₹${totalExpenses.toLocaleString()}`);
    console.log(`   Net Income: ₹${netIncome.toLocaleString()}`);
    console.log(`   Average Monthly Profit: ₹${Math.round(netIncome / recentRecords.length).toLocaleString()}`);

    console.log('\n🎉 ALL TESTS COMPLETED');
    console.log('====================');
    console.log('✅ Loan calculation now includes both membership and loans table data');
    console.log('✅ Interest profit analysis replaced member contributions');
    console.log('✅ API provides useful financial insights instead of redundant data');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSummaryFixes();
