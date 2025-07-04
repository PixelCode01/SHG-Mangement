#!/usr/bin/env node

/**
 * Diagnostic script to test group standing calculation
 * Tests the actual API response and calculation logic
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function testGroupStandingCalculation() {
  console.log('🧪 TESTING GROUP STANDING CALCULATION');
  console.log('=====================================\n');
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  try {
    // Find a test group with financial data
    const testGroup = await db.collection('Group').findOne({
      $or: [
        { name: { $regex: /test/i } },
        { cashInHand: { $exists: true, $gt: 0 } },
        { balanceInBank: { $exists: true, $gt: 0 } }
      ]
    });
    
    if (!testGroup) {
      console.log('❌ No suitable test group found');
      return;
    }
    
    console.log('📊 Found test group:');
    console.log(`   Name: ${testGroup.name}`);
    console.log(`   ID: ${testGroup._id}`);
    console.log(`   Cash in Hand: ₹${testGroup.cashInHand || 0}`);
    console.log(`   Balance in Bank: ₹${testGroup.balanceInBank || 0}`);
    console.log(`   Monthly Contribution: ₹${testGroup.monthlyContribution || 0}`);
    console.log(`   Interest Rate: ${testGroup.interestRate || 0}%`);
    
    // Get all members of this group
    const members = await db.collection('Member').find({
      groupId: testGroup._id
    }).toArray();
    
    console.log(`\n👥 Group Members (${members.length}):`);
    members.forEach((member, index) => {
      console.log(`   ${index + 1}. ${member.name} (ID: ${member._id})`);
    });
    
    // Get all active loans for these members
    const memberIds = members.map(m => m._id);
    const loans = await db.collection('Loan').find({
      memberId: { $in: memberIds },
      status: 'ACTIVE'
    }).toArray();
    
    console.log(`\n💰 Active Loans (${loans.length}):`);
    let totalLoanAmount = 0;
    
    // Group loans by member for better understanding
    const loansByMember = {};
    members.forEach(member => {
      loansByMember[member._id.toString()] = [];
    });
    
    loans.forEach(loan => {
      const memberIdStr = loan.memberId.toString();
      if (loansByMember[memberIdStr]) {
        loansByMember[memberIdStr].push(loan);
        totalLoanAmount += loan.currentBalance || 0;
      }
    });
    
    members.forEach(member => {
      const memberLoans = loansByMember[member._id.toString()];
      const memberLoanBalance = memberLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
      console.log(`   ${member.name}: ₹${memberLoanBalance} (${memberLoans.length} loans)`);
      memberLoans.forEach(loan => {
        console.log(`     - Loan ID: ${loan._id}, Amount: ₹${loan.amount}, Current Balance: ₹${loan.currentBalance}, Status: ${loan.status}`);
      });
    });
    
    // Calculate total group standing
    const totalCash = (testGroup.cashInHand || 0) + (testGroup.balanceInBank || 0);
    const totalGroupStanding = totalCash + totalLoanAmount;
    
    console.log(`\n📈 GROUP STANDING CALCULATION:`);
    console.log(`   Cash in Hand: ₹${testGroup.cashInHand || 0}`);
    console.log(`   Balance in Bank: ₹${testGroup.balanceInBank || 0}`);
    console.log(`   Total Cash: ₹${totalCash}`);
    console.log(`   Total Loan Amount: ₹${totalLoanAmount}`);
    console.log(`   ═══════════════════════════════`);
    console.log(`   TOTAL GROUP STANDING: ₹${totalGroupStanding}`);
    
    // Now test what the Group API would return
    console.log(`\n🔍 TESTING GROUP API RESPONSE SIMULATION:`);
    
    // Simulate the Group API response (what the frontend would receive)
    const apiResponse = {
      ...testGroup,
      members: members.map(member => {
        const memberLoans = loansByMember[member._id.toString()];
        const currentLoanBalance = memberLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
        
        return {
          id: member._id.toString(),
          name: member.name,
          currentLoanBalance, // This should be included by the API
          loans: memberLoans.map(loan => ({
            currentBalance: loan.currentBalance || 0
          }))
        };
      })
    };
    
    console.log('   API Response structure:');
    console.log(`   - Group ID: ${apiResponse._id}`);
    console.log(`   - Group Name: ${apiResponse.name}`);
    console.log(`   - Cash in Hand: ₹${apiResponse.cashInHand || 0}`);
    console.log(`   - Balance in Bank: ₹${apiResponse.balanceInBank || 0}`);
    console.log(`   - Members: ${apiResponse.members.length}`);
    
    apiResponse.members.forEach(member => {
      console.log(`     • ${member.name}: ₹${member.currentLoanBalance} (${member.loans.length} loans)`);
    });
    
    // Test the frontend calculation logic
    console.log(`\n🧮 TESTING FRONTEND CALCULATION LOGIC:`);
    
    const frontendTotalCash = (apiResponse.cashInHand || 0) + (apiResponse.balanceInBank || 0);
    
    // Method 1: Using currentLoanBalance (recommended)
    const frontendTotalLoanAmount1 = apiResponse.members.reduce((sum, member) => {
      return sum + (member.currentLoanBalance || 0);
    }, 0);
    
    // Method 2: Using loans array (what current code tries to do)
    const frontendTotalLoanAmount2 = apiResponse.members.reduce((sum, member) => {
      const memberLoans = member.loans || [];
      const memberLoanBalance = memberLoans.reduce((loanSum, loan) => loanSum + (loan.currentBalance || 0), 0);
      return sum + memberLoanBalance;
    }, 0);
    
    const frontendTotalGroupStanding1 = frontendTotalCash + frontendTotalLoanAmount1;
    const frontendTotalGroupStanding2 = frontendTotalCash + frontendTotalLoanAmount2;
    
    console.log(`   Method 1 (using currentLoanBalance): ₹${frontendTotalGroupStanding1}`);
    console.log(`   Method 2 (using loans array): ₹${frontendTotalGroupStanding2}`);
    console.log(`   Database actual: ₹${totalGroupStanding}`);
    
    if (frontendTotalGroupStanding1 === totalGroupStanding) {
      console.log(`   ✅ Method 1 is CORRECT`);
    } else {
      console.log(`   ❌ Method 1 is INCORRECT`);
    }
    
    if (frontendTotalGroupStanding2 === totalGroupStanding) {
      console.log(`   ✅ Method 2 is CORRECT`);
    } else {
      console.log(`   ❌ Method 2 is INCORRECT`);
    }
    
    console.log(`\n🎯 RECOMMENDATIONS:`);
    if (frontendTotalGroupStanding1 === totalGroupStanding) {
      console.log(`   ✅ Use currentLoanBalance property from API`);
      console.log(`   ✅ Group API should include currentLoanBalance for each member`);
    }
    
    if (frontendTotalGroupStanding2 !== totalGroupStanding) {
      console.log(`   ❌ Current loans array approach needs fixing`);
      console.log(`   ❌ Either API doesn't return loans or calculation is wrong`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testGroupStandingCalculation().catch(console.error);
