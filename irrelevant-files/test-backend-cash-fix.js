const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBackendCashFix() {
  console.log('🧪 Testing Backend Cash Balance Fix...\n');

  try {
    // Find test group
    const group = await prisma.group.findFirst({
      where: { name: 'gd' },
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        _count: {
          select: { groupPeriodicRecords: true }
        }
      }
    });

    if (!group) {
      console.log('❌ Test group "gd" not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand}`);
    console.log(`🏦 Initial Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`📋 Existing Records: ${group._count.groupPeriodicRecords}\n`);

    const totalStartingCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
    console.log(`💵 Total Starting Cash: ₹${totalStartingCash}`);

    // Get any existing records to calculate current cash state
    let currentCashFromRecords = 0;
    if (group._count.groupPeriodicRecords > 0) {
      const latestRecord = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId: group.id },
        orderBy: { meetingDate: 'desc' },
        select: {
          cashInBankAtEndOfPeriod: true,
          cashInHandAtEndOfPeriod: true
        }
      });
      
      if (latestRecord) {
        currentCashFromRecords = (latestRecord.cashInBankAtEndOfPeriod || 0) + (latestRecord.cashInHandAtEndOfPeriod || 0);
        console.log(`💰 Current Cash from Latest Record: ₹${currentCashFromRecords}`);
      }
    }
    
    const effectiveStartingCash = group._count.groupPeriodicRecords === 0 ? totalStartingCash : currentCashFromRecords;
    console.log(`📊 Effective Starting Cash: ₹${effectiveStartingCash}`);

    // Test parameters
    const testData = {
      meetingDate: new Date().toISOString(),
      newContributionsThisPeriod: 1000,
      expensesThisPeriod: 100,
      memberRecords: [
        {
          memberId: "675c4d5ea0b8e1e4b8c66d9c", // Test member
          compulsoryContribution: 1000, // This is what drives the contributions calculation
          loanRepaymentPrincipal: 300
        }
      ]
    };

    console.log(`\n🧪 Test Calculation (what backend should do):`);
    console.log(`  Starting Cash: ₹${effectiveStartingCash}`);
    console.log(`  + Collection: ₹${testData.memberRecords[0].compulsoryContribution}`);
    console.log(`  + Loan Repayments: ₹300`);
    console.log(`  - Expenses: ₹${testData.expensesThisPeriod}`);
    
    const expectedCashBalance = effectiveStartingCash + testData.memberRecords[0].compulsoryContribution + 300 - testData.expensesThisPeriod;
    console.log(`  = Expected Cash Balance: ₹${expectedCashBalance}\n`);

    // Make API call to create record
    console.log('🚀 Creating periodic record via API...');
    
    const response = await fetch(`http://localhost:3004/api/groups/${group.id}/periodic-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API Error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Record created successfully!\n');

    // Check the calculation
    console.log('📊 Backend Calculation Results:');
    console.log(`  Cash In Bank: ₹${result.cashInBankAtEndOfPeriod || 0}`);
    console.log(`  Cash In Hand: ₹${result.cashInHandAtEndOfPeriod || 0}`);
    
    const actualTotalCash = (result.cashInBankAtEndOfPeriod || 0) + (result.cashInHandAtEndOfPeriod || 0);
    console.log(`  Total Cash: ₹${actualTotalCash}`);
    console.log(`  Expected: ₹${expectedCashBalance}`);
    
    if (actualTotalCash === expectedCashBalance) {
      console.log('✅ Cash calculation is CORRECT!');
    } else {
      console.log(`❌ Cash calculation mismatch. Difference: ₹${actualTotalCash - expectedCashBalance}`);
    }

    // Clean up - delete the test record and its member records
    console.log('\n🧹 Cleaning up test record...');
    await prisma.groupMemberPeriodicRecord.deleteMany({
      where: { groupPeriodicRecordId: result.id }
    });
    await prisma.groupPeriodicRecord.delete({
      where: { id: result.id }
    });
    console.log('✅ Test record deleted');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBackendCashFix();
