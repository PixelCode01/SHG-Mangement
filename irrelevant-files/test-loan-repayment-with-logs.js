/**
 * Test Loan Repayment with Enhanced Logging
 * 
 * This script helps test the loan repayment functionality with detailed logging
 * to identify the root cause of the "Failed to process loan repayment" error.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLoanRepaymentLogging() {
  console.log('🧪 TESTING LOAN REPAYMENT WITH ENHANCED LOGGING');
  console.log('=' .repeat(60));
  
  try {
    // 1. Find a group with members who have active loans
    console.log('\n1. 🔍 Finding test group with active loans...');
    
    const testGroup = await prisma.group.findFirst({
      where: {
        memberships: {
          some: {
            member: {
              loans: {
                some: {
                  status: 'ACTIVE',
                  currentBalance: { gt: 0 }
                }
              }
            }
          }
        }
      },
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
        }
      }
    });

    if (!testGroup) {
      console.log('❌ No groups with active loans found');
      console.log('\n📋 MANUAL TESTING INSTRUCTIONS:');
      console.log('1. Start the development server: npm run dev');
      console.log('2. Navigate to: http://localhost:3000/groups');
      console.log('3. Select a group and go to the contributions page');
      console.log('4. Try the loan repayment functionality');
      console.log('5. Check the browser console for detailed logs');
      console.log('\n🔍 WHAT TO LOOK FOR IN BROWSER CONSOLE:');
      console.log('- 🚀 LOAN REPAYMENT: Starting process...');
      console.log('- 📋 Initial validation check');
      console.log('- 💰 Amount parsing result');
      console.log('- 📤 Sending API request');
      console.log('- 📥 API response status');
      console.log('- ❌ Any error messages');
      return;
    }

    console.log(`✅ Found test group: ${testGroup.name} (ID: ${testGroup.id})`);

    // 2. Find a member with an active loan
    const memberWithLoan = testGroup.memberships.find(m => 
      m.member.loans.length > 0 && 
      m.member.loans.some(loan => loan.currentBalance > 0)
    );

    if (!memberWithLoan) {
      console.log('❌ No members with active loans found in this group');
      return;
    }

    const activeLoan = memberWithLoan.member.loans.find(loan => loan.currentBalance > 0);
    console.log(`✅ Found member with active loan:`);
    console.log(`   Member: ${memberWithLoan.member.name} (ID: ${memberWithLoan.member.id})`);
    console.log(`   Loan ID: ${activeLoan.id}`);
    console.log(`   Current Balance: ₹${activeLoan.currentBalance}`);

    // 3. Show testing instructions
    console.log('\n🌐 FRONTEND TESTING INSTRUCTIONS:');
    console.log('-'.repeat(40));
    console.log('1. Start the development server if not already running:');
    console.log('   npm run dev');
    console.log('\n2. Navigate to the contributions page:');
    console.log(`   http://localhost:3000/groups/${testGroup.id}/contributions`);
    console.log('\n3. Test the loan repayment process:');
    console.log('   - Click "Show Loan Management"');
    console.log(`   - Find member: ${memberWithLoan.member.name}`);
    console.log('   - Click "Repay" button');
    console.log(`   - Enter amount: ₹500 (max: ₹${activeLoan.currentBalance})`);
    console.log('   - Click "Process Repayment"');

    console.log('\n🔍 DEBUGGING CHECKLIST:');
    console.log('-'.repeat(40));
    console.log('✅ Enhanced logging added to frontend (handleLoanRepayment)');
    console.log('✅ Enhanced logging added to API route (/api/groups/[id]/loans/repay)');
    console.log('✅ Validation checks for data types and values');
    console.log('✅ Database query logging for loan lookup');
    console.log('✅ Request/response logging for debugging');

    console.log('\n💡 EXPECTED LOG FLOW:');
    console.log('-'.repeat(40));
    console.log('Frontend Console:');
    console.log('1. 💰 LOAN REPAYMENT: Setting up repayment for member');
    console.log('2. 💰 LOAN REPAYMENT: Amount input changed');
    console.log('3. 💰 LOAN REPAYMENT: Submit button clicked');
    console.log('4. 🚀 LOAN REPAYMENT: Starting process...');
    console.log('5. 📋 Initial validation check');
    console.log('6. 💰 Amount parsing result');
    console.log('7. 📤 Sending API request');
    console.log('8. 📥 API response status');
    console.log('9. Either ✅ success or ❌ error with details');

    console.log('\nServer Console:');
    console.log('1. 🏦 API LOAN REPAY: Request received');
    console.log('2. 🔐 Authentication successful');
    console.log('3. 📋 Request body received');
    console.log('4. 🔍 Input validation');
    console.log('5. 🔍 Starting loan lookup');
    console.log('6. 📊 Loan lookup result');
    console.log('7. ✅ or ❌ final result');

    console.log('\n🎯 POSSIBLE ERROR SOURCES TO VALIDATE:');
    console.log('-'.repeat(40));
    console.log('1. Data Type Issues: Check if amount becomes NaN');
    console.log('2. Database Issues: Verify loan lookup by memberId works');
    console.log('3. Authentication: Ensure user has edit permissions');
    console.log('4. Validation: Check amount vs current balance validation');
    console.log('5. Network: Verify API route is accessible');

    console.log('\n🚀 Ready for testing! Start the server and follow the instructions above.');

  } catch (error) {
    console.error('❌ Error setting up test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testLoanRepaymentLogging();
}

module.exports = { testLoanRepaymentLogging };
