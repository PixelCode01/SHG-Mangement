/**
 * Test script to create a group with financial data and test periodic record initialization
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestGroupWithFinancialData() {
  console.log('🧪 CREATING TEST GROUP WITH FINANCIAL DATA');
  console.log('============================================================\n');

  try {
    // Step 1: Create a test member
    console.log('1. Creating test member...');
    const testMember = await prisma.member.create({
      data: {
        name: 'Test Leader Financial',
        phone: '9876543210',
        email: 'test.leader.financial@example.com',
        address: 'Test Address'
      }
    });
    console.log(`   ✅ Created member: ${testMember.name} (ID: ${testMember.id})`);

    // Step 2: Create a group with financial data
    console.log('\n2. Creating group with financial data...');
    const uniqueId = `GRP-FIN-${Date.now()}`;
    const testGroup = await prisma.group.create({
      data: {
        groupId: uniqueId,                 // Required unique field
        name: 'Test Financial Group',
        address: 'Financial Test Address',
        bankName: 'Test Bank',
        bankAccountNumber: '1234567890',
        // Financial fields
        cashInHand: 5000.00,           // ₹5,000 cash
        balanceInBank: 15000.00,       // ₹15,000 in bank
        monthlyContribution: 500.00,   // ₹500 per member per month
        interestRate: 2.5,             // 2.5% interest rate
        leaderId: testMember.id
      }
    });
    console.log(`   ✅ Created group: ${testGroup.name} (ID: ${testGroup.id})`);
    console.log(`   💰 Financial Data:`);
    console.log(`      - Cash in Hand: ₹${testGroup.cashInHand}`);
    console.log(`      - Balance in Bank: ₹${testGroup.balanceInBank}`);
    console.log(`      - Monthly Contribution: ₹${testGroup.monthlyContribution}`);
    console.log(`      - Interest Rate: ${testGroup.interestRate}%`);

    // Step 3: Create membership
    console.log('\n3. Creating membership...');
    await prisma.memberGroupMembership.create({
      data: {
        groupId: testGroup.id,
        memberId: testMember.id,
        joinedAt: new Date()
      }
    });
    console.log(`   ✅ Created membership for ${testMember.name}`);

    // Step 4: Add some additional members for testing
    console.log('\n4. Adding additional members...');
    const members = [];
    for (let i = 1; i <= 3; i++) {        const member = await prisma.member.create({
          data: {
            name: `Member ${i}`,
            phone: `987654321${i}`,
            email: `member${i}@example.com`,
            address: `Address ${i}`
          }
        });        await prisma.memberGroupMembership.create({
          data: {
            groupId: testGroup.id,
            memberId: member.id,
            joinedAt: new Date()
          }
        });
      
      members.push(member);
      console.log(`   ✅ Added member: ${member.name}`);
    }

    // Step 5: Add some loans to test interest calculation
    console.log('\n5. Adding test loans...');
    let totalLoanAmount = 0;
    for (let i = 0; i < 2; i++) {
      const loanAmount = (i + 1) * 2000; // ₹2000, ₹4000
      await prisma.loan.create({
        data: {
          groupId: testGroup.id,
          memberId: members[i].id,
          loanType: 'PERSONAL',
          originalAmount: loanAmount,
          currentBalance: loanAmount,
          dateIssued: new Date(),
          interestRate: testGroup.interestRate / 100, // Convert percentage to decimal
          status: 'ACTIVE'
        }
      });
      totalLoanAmount += loanAmount;
      console.log(`   ✅ Created loan of ₹${loanAmount} for ${members[i].name}`);
    }

    // Step 6: Display group summary
    console.log('\n6. GROUP SUMMARY FOR PERIODIC RECORD TESTING');
    console.log('----------------------------------------');
    const totalCash = testGroup.cashInHand + testGroup.balanceInBank;
    const totalGroupStanding = totalCash + totalLoanAmount;
    
    console.log(`Group: ${testGroup.name}`);
    console.log(`Members: 4 (1 leader + 3 members)`);
    console.log(`Cash in Hand: ₹${testGroup.cashInHand}`);
    console.log(`Balance in Bank: ₹${testGroup.balanceInBank}`);
    console.log(`Total Cash: ₹${totalCash}`);
    console.log(`Total Loan Amount: ₹${totalLoanAmount}`);
    console.log(`Total Group Standing: ₹${totalGroupStanding}`);
    console.log(`Monthly Contribution per Member: ₹${testGroup.monthlyContribution}`);
    console.log(`Interest Rate: ${testGroup.interestRate}%`);
    
    // Step 7: Expected periodic record initialization values
    console.log('\n7. EXPECTED PERIODIC RECORD INITIALIZATION');
    console.log('----------------------------------------');
    console.log(`Standing at Start: ₹${totalGroupStanding}`);
    console.log(`Cash in Bank at End: ₹${testGroup.balanceInBank}`);
    console.log(`Cash in Hand at End: ₹${testGroup.cashInHand}`);
    console.log(`Interest Rate: ${testGroup.interestRate}%`);
    console.log(`Compulsory Contribution: ₹${testGroup.monthlyContribution}`);
    console.log(`Share per Member (initial): ₹${(totalGroupStanding / 4).toFixed(2)}`);

    // Test expected interest calculation
    const expectedInterest = (totalLoanAmount * testGroup.interestRate) / 100;
    console.log(`Expected Interest Earned (if monthly): ₹${expectedInterest.toFixed(2)}`);

    console.log('\n🎯 TEST COMPLETE! You can now:');
    console.log('1. Navigate to http://localhost:3000/groups');
    console.log(`2. Find the group "${testGroup.name}"`);
    console.log('3. Click "Create Periodic Record"');
    console.log('4. Verify that the form is pre-filled with the values shown above');
    
    return {
      groupId: testGroup.id,
      groupName: testGroup.name,
      totalGroupStanding,
      memberCount: 4
    };

  } catch (error) {
    console.error('❌ Error creating test group:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  createTestGroupWithFinancialData()
    .then((result) => {
      console.log('\n✅ Test group created successfully!');
      console.log(`Group ID: ${result.groupId}`);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestGroupWithFinancialData };
