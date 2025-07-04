// Test script for the new financial group
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFinancialGroup() {
  console.log('🧪 TESTING FINANCIAL GROUP CALCULATION');
  console.log('=====================================\n');

  try {
    // Find the test financial group
    const testGroup = await prisma.group.findFirst({
      where: {
        name: 'Test Financial Group'
      },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!testGroup) {
      console.log('❌ Test Financial Group not found');
      return;
    }

    console.log('📊 Found test group:');
    console.log(`   Name: ${testGroup.name}`);
    console.log(`   ID: ${testGroup.id}`);
    console.log(`   Cash in Hand: ₹${testGroup.cashInHand || 0}`);
    console.log(`   Balance in Bank: ₹${testGroup.balanceInBank || 0}`);
    console.log(`   Monthly Contribution: ₹${testGroup.monthlyContribution || 0}`);
    console.log(`   Interest Rate: ${testGroup.interestRate || 0}%`);
    console.log('');

    console.log(`👥 Group Members (${testGroup.memberships.length}):`);
    testGroup.memberships.forEach((membership, index) => {
      const member = membership.member;
      const activeLoanBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      console.log(`   ${index + 1}. ${member.name} - Loan Balance: ₹${activeLoanBalance}`);
    });
    console.log('');

    // Calculate total loan amount
    const totalLoanAmount = testGroup.memberships.reduce((sum, membership) => {
      const memberLoanBalance = membership.member.loans.reduce((loanSum, loan) => loanSum + loan.currentBalance, 0);
      return sum + memberLoanBalance;
    }, 0);

    console.log('📈 GROUP STANDING CALCULATION:');
    console.log(`   Cash in Hand: ₹${testGroup.cashInHand || 0}`);
    console.log(`   Balance in Bank: ₹${testGroup.balanceInBank || 0}`);
    console.log(`   Total Cash: ₹${(testGroup.cashInHand || 0) + (testGroup.balanceInBank || 0)}`);
    console.log(`   Total Loan Amount: ₹${totalLoanAmount}`);
    console.log('   ═══════════════════════════════');
    console.log(`   TOTAL GROUP STANDING: ₹${(testGroup.cashInHand || 0) + (testGroup.balanceInBank || 0) + totalLoanAmount}`);
    console.log('');

    // Test API response simulation
    console.log('🔍 TESTING API RESPONSE SIMULATION:');
    const apiSimulatedResponse = {
      ...testGroup,
      members: testGroup.memberships.map(m => ({
        id: m.member.id,
        name: m.member.name,
        currentLoanBalance: m.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0,
      }))
    };

    console.log('   API Response structure:');
    console.log(`   - Group ID: ${apiSimulatedResponse.id}`);
    console.log(`   - Group Name: ${apiSimulatedResponse.name}`);
    console.log(`   - Cash in Hand: ₹${apiSimulatedResponse.cashInHand || 0}`);
    console.log(`   - Balance in Bank: ₹${apiSimulatedResponse.balanceInBank || 0}`);
    console.log(`   - Members: ${apiSimulatedResponse.members.length}`);
    apiSimulatedResponse.members.forEach((member, index) => {
      console.log(`     ${index + 1}. ${member.name} - currentLoanBalance: ₹${member.currentLoanBalance}`);
    });
    console.log('');

    // Test frontend calculation
    console.log('🧮 TESTING FRONTEND CALCULATION LOGIC:');
    const totalCash = (apiSimulatedResponse.cashInHand || 0) + (apiSimulatedResponse.balanceInBank || 0);
    const frontendLoanTotal = apiSimulatedResponse.members.reduce((sum, member) => {
      return sum + (member.currentLoanBalance || 0);
    }, 0);
    const frontendGroupStanding = totalCash + frontendLoanTotal;
    
    console.log(`   Frontend calculation: ₹${frontendGroupStanding}`);
    console.log(`   Database calculation: ₹${(testGroup.cashInHand || 0) + (testGroup.balanceInBank || 0) + totalLoanAmount}`);
    
    if (frontendGroupStanding === ((testGroup.cashInHand || 0) + (testGroup.balanceInBank || 0) + totalLoanAmount)) {
      console.log('   ✅ Frontend calculation MATCHES database calculation');
    } else {
      console.log('   ❌ Frontend calculation DOES NOT MATCH database calculation');
    }
    console.log('');

    // Test expected periodic record values
    console.log('📋 EXPECTED PERIODIC RECORD INITIALIZATION:');
    console.log(`   Standing at Start: ₹${frontendGroupStanding}`);
    console.log(`   Cash in Bank at End: ₹${apiSimulatedResponse.balanceInBank || 0}`);
    console.log(`   Cash in Hand at End: ₹${apiSimulatedResponse.cashInHand || 0}`);
    console.log(`   Compulsory Contribution: ₹${apiSimulatedResponse.monthlyContribution || 0}`);
    console.log(`   Share per Member: ₹${(frontendGroupStanding / apiSimulatedResponse.members.length).toFixed(2)}`);
    
    // Calculate expected interest based on collection frequency
    const interestRate = (apiSimulatedResponse.interestRate || 0) / 100;
    const expectedMonthlyInterest = totalLoanAmount * interestRate;
    console.log(`   Expected Interest Earned (monthly): ₹${expectedMonthlyInterest.toFixed(2)}`);

  } catch (error) {
    console.error('Error testing financial group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFinancialGroup();
