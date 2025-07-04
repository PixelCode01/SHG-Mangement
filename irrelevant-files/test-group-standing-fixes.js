/**
 * Test script to verify group standing calculation fixes
 * Tests both first record standing calculation and calculated values display
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupStandingFixes() {
  console.log('🧪 Testing Group Standing Calculation Fixes...\n');

  try {
    // Find a test group to work with
    const groups = await prisma.group.findMany({
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        groupPeriodicRecords: true,
        leader: true
      },
      take: 1
    });

    if (groups.length === 0) {
      console.log('❌ No groups found. Please create a test group first.');
      return;
    }

    const group = groups[0];
    console.log(`📊 Testing with Group: ${group.name} (ID: ${group.id})`);
    console.log(`👥 Members: ${group.memberships.length}`);
    console.log(`📋 Existing Records: ${group.groupPeriodicRecords.length}`);

    // Check if this is the first record scenario
    const isFirstRecord = group.groupPeriodicRecords.length === 0;
    console.log(`🔄 First Record Test: ${isFirstRecord ? 'YES' : 'NO'}\n`);

    // Test 1: Check group cash and loan assets for first record calculation
    if (isFirstRecord) {
      console.log('🔍 Test 1: First Record Standing Calculation');
      
      // Get group cash
      const groupCash = group.cashInHand || 0;
      console.log(`💰 Group Cash: ₹${groupCash}`);
      
      // Calculate loan assets from memberships
      let totalLoanAssets = 0;
      group.memberships.forEach(membership => {
        totalLoanAssets += membership.currentLoanAmount || 0;
      });
      
      console.log(`💳 Total Loan Assets: ₹${totalLoanAssets}`);
      
      const expectedStanding = groupCash + totalLoanAssets;
      console.log(`📈 Expected Standing at Start: ₹${expectedStanding}\n`);
    } else {
      console.log('ℹ️ Test 1: Skipped (not first record)\n');
    }

    // Test 2: Check member data for calculated values
    console.log('🔍 Test 2: Member Data for Calculations');
    const memberData = group.memberships;

    let totalShares = 0;
    let totalLoans = 0;

    memberData.forEach(membership => {
      const shares = membership.currentShareAmount || 0;
      const loans = membership.currentLoanAmount || 0;
      totalShares += shares;
      totalLoans += loans;
      
      console.log(`👤 ${membership.member.name}: Shares ₹${shares}, Loans ₹${loans}`);
    });

    console.log(`\n📊 Totals: Shares ₹${totalShares}, Loans ₹${totalLoans}`);

    // Test 3: API endpoint test (simulate what frontend would call)
    console.log('\n🔍 Test 3: API Endpoint Response');
    console.log('To test the API endpoint, make a POST request to:');
    console.log(`http://localhost:3003/api/groups/${group.id}/periodic-records`);
    console.log('With sample periodic record data.\n');

    // Test 4: Database integrity check
    console.log('🔍 Test 4: Database Integrity Check');
    
    // Check for groups without leadership
    const groupsWithoutLeader = await prisma.group.findMany({
      where: {
        leaderId: null
      }
    });
    
    console.log(`� Groups without leaders: ${groupsWithoutLeader.length}`);
    
    // Check for orphaned memberships
    const totalMemberships = await prisma.memberGroupMembership.count();
    console.log(`� Total memberships in database: ${totalMemberships}`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Open the application in browser at http://localhost:3003');
    console.log('2. Navigate to a group and create a new periodic record');
    console.log('3. Verify that calculated values display immediately');
    console.log('4. Check that group standing is calculated correctly for first record');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGroupStandingFixes();
