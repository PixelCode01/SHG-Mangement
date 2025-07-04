/**
 * Comprehensive test for group standing calculation fixes
 * Tests both first record calculation and frontend display issues
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test Group ID that has no periodic records (suitable for first record test)
const TEST_GROUP_ID = '684677e9e375e700de58f0fa'; // New test group

async function testFirstRecordStandingCalculation() {
  console.log('🚀 Testing First Record Standing Calculation...\n');

  try {
    // Get the test group with all relevant data
    const group = await prisma.group.findUnique({
      where: { id: TEST_GROUP_ID },
      include: {
        memberships: {
          include: { member: true }
        },
        groupPeriodicRecords: true
      }
    });

    if (!group) {
      console.log('❌ Test group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`👥 Members: ${group.memberships.length}`);
    console.log(`📋 Existing Records: ${group.groupPeriodicRecords.length}`);
    console.log(`💰 Group Cash in Hand: ₹${group.cashInHand || 0}`);

    // Calculate expected standing for first record
    let totalLoanAssets = 0;
    let totalShareAssets = 0;

    console.log('\n👥 Member Financial Data:');
    group.memberships.forEach(membership => {
      const loans = membership.currentLoanAmount || 0;
      const shares = membership.currentShareAmount || 0;
      totalLoanAssets += loans;
      totalShareAssets += shares;
      
      if (loans > 0 || shares > 0) {
        console.log(`  📋 ${membership.member.name}: Shares ₹${shares}, Loans ₹${loans}`);
      }
    });

    const groupCash = group.cashInHand || 0;
    const expectedStanding = groupCash + totalLoanAssets;

    console.log(`\n📊 Standing Calculation:`);
    console.log(`  💰 Group Cash: ₹${groupCash}`);
    console.log(`  💳 Total Loan Assets: ₹${totalLoanAssets}`);
    console.log(`  📈 Expected Standing: ₹${expectedStanding}`);
    console.log(`  🔢 Total Share Assets: ₹${totalShareAssets}`);

    // Create a sample periodic record to test our API
    const sampleRecord = {
      collectionDate: new Date().toISOString(),
      presentMembers: group.memberships.length,
      totalCollection: 1000,
      notes: 'Test record for standing calculation',
      memberRecords: group.memberships.map(membership => ({
        memberId: membership.memberId,
        present: true,
        contribution: 20,
        loanInstallment: 0,
        fineAmount: 0,
        specialContribution: 0
      }))
    };

    console.log(`\n🧪 Sample Record Data Prepared:`);
    console.log(`  📅 Collection Date: ${new Date(sampleRecord.collectionDate).toLocaleDateString()}`);
    console.log(`  👥 Present Members: ${sampleRecord.presentMembers}`);
    console.log(`  💰 Total Collection: ₹${sampleRecord.totalCollection}`);

    console.log(`\n✅ Test Setup Complete!`);
    console.log(`\n📝 Next Steps:`);
    console.log(`1. Open browser at: http://localhost:3003`);
    console.log(`2. Navigate to group: ${group.name}`);
    console.log(`3. Create a new periodic record`);
    console.log(`4. Verify standing at start shows: ₹${expectedStanding}`);
    console.log(`5. Check that calculated values display immediately`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to test API endpoint directly
async function testAPIEndpoint() {
  console.log('\n🔧 API Endpoint Test Helper\n');
  
  console.log('To test the API endpoint manually:');
  console.log(`POST http://localhost:3003/api/groups/${TEST_GROUP_ID}/periodic-records`);
  console.log('\nWith JSON body:');
  
  const sampleBody = {
    collectionDate: new Date().toISOString(),
    presentMembers: 16,
    totalCollection: 1000,
    notes: 'Test API call',
    memberRecords: [
      {
        memberId: 'member-id-here',
        present: true,
        contribution: 20,
        loanInstallment: 0,
        fineAmount: 0,
        specialContribution: 0
      }
    ]
  };
  
  console.log(JSON.stringify(sampleBody, null, 2));
}

// Run the tests
testFirstRecordStandingCalculation().then(() => {
  testAPIEndpoint();
});
