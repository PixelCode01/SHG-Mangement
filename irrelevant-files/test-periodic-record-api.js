const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodicRecordAPI() {
  try {
    console.log('🧪 Testing Periodic Record API with Group Standing Fix...\n');

    const groupId = '68382afd6cad8afd7cf5bb1f';
    
    // Test data
    const testPeriodicData = {
      meetingDate: new Date().toISOString(),
      standingAtStartOfPeriod: 50000,
      newContributionsThisPeriod: 10000,
      expensesThisPeriod: 2000,
      cashInHandAtEndOfPeriod: 58000,
      memberRecords: [
        {
          memberId: '68382afe6cad8afd7cf5bb21',
          compulsoryContribution: 3000,
          loanRepaymentPrincipal: 0,
          lateFinePaid: 0
        },
        {
          memberId: '68382afe6cad8afd7cf5bb22',
          compulsoryContribution: 3000,
          loanRepaymentPrincipal: 500,
          lateFinePaid: 0
        },
        {
          memberId: '68382afe6cad8afd7cf5bb23',
          compulsoryContribution: 4000,
          loanRepaymentPrincipal: 0,
          lateFinePaid: 0
        }
      ]
    };

    console.log('📝 Creating periodic record via API...');
    console.log('Test data:', JSON.stringify(testPeriodicData, null, 2));

    const response = await fetch(`http://localhost:3000/api/groups/${groupId}/periodic-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPeriodicData)
    });

    if (!response.ok) {
      console.error(`❌ API call failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('\n✅ Periodic record created successfully!');
    console.log('API Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n📊 Key values to verify:');
    console.log(`   - Total Group Standing: ₹${result.totalGroupStandingAtEndOfPeriod}`);
    console.log(`   - Cash in Hand: ₹${result.cashInHandAtEndOfPeriod}`);
    console.log(`   - Cash in Bank: ₹${result.cashInBankAtEndOfPeriod}`);
    
    // Expected: Total should be significantly higher than cash due to loan assets
    const expectedCashBalance = 50000 + 10000 - 2000; // 58000
    const expectedLoanAssets = 22200; // From our previous calculation
    const expectedTotal = expectedCashBalance + expectedLoanAssets; // 80200
    
    console.log(`\n🎯 Expected vs Actual:`);
    console.log(`   - Expected cash balance: ₹${expectedCashBalance}`);
    console.log(`   - Expected loan assets: ₹${expectedLoanAssets}`);
    console.log(`   - Expected total: ₹${expectedTotal}`);
    console.log(`   - Actual total: ₹${result.totalGroupStandingAtEndOfPeriod}`);
    
    if (Math.abs(result.totalGroupStandingAtEndOfPeriod - expectedTotal) < 0.01) {
      console.log('✅ GROUP STANDING CALCULATION FIX WORKING CORRECTLY!');
    } else {
      console.log('❌ Total group standing does not match expected value');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodicRecordAPI();
