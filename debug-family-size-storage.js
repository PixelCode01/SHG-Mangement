// Debug script to test family size storage issue in group creation step 4
// This will help identify why family sizes are not being stored correctly

console.log('🔍 Starting family size storage debug...');

async function debugFamilySizeStorage() {
  try {
    // Simulate the data structure from MultiStepGroupForm submission
    const testSubmissionData = {
      name: 'Test Group for Family Size Debug',
      members: [
        {
          memberId: 'temp-12345-1',
          currentShare: 100,
          currentLoanAmount: 0,
          familyMembersCount: 5 // Test family size
        },
        {
          memberId: 'temp-12345-2', 
          currentShare: 100,
          currentLoanAmount: 0,
          familyMembersCount: 3 // Test family size
        }
      ],
      collectionFrequency: 'MONTHLY',
      lateFineRule: null
    };

    console.log('📝 Test submission data structure:');
    console.log(JSON.stringify(testSubmissionData, null, 2));

    // Check what the group creation API expects
    console.log('\n🔍 Checking group creation API expectations...');
    console.log('Based on route.ts analysis:');
    console.log('- API expects: membersData with familyMembersCount field');
    console.log('- API processes: memberInfo.familyMembersCount');
    console.log('- Update query: await tx.member.update({ where: { id: memberInfo.memberId }, data: { familyMembersCount: memberInfo.familyMembersCount } })');

    // Test the data mapping from form to API
    const membersData = testSubmissionData.members.map(member => ({
      memberId: member.memberId,
      currentShareAmount: member.currentShare,
      currentLoanAmount: member.currentLoanAmount,
      familyMembersCount: member.familyMembersCount // This should be included
    }));

    console.log('\n📤 Data that would be sent to API:');
    console.log('membersData:', JSON.stringify(membersData, null, 2));

    // Verify each member has familyMembersCount
    membersData.forEach((memberInfo, index) => {
      console.log(`Member ${index + 1} familyMembersCount:`, memberInfo.familyMembersCount);
      if (memberInfo.familyMembersCount !== undefined) {
        console.log(`✅ Member ${index + 1}: familyMembersCount = ${memberInfo.familyMembersCount} (will be updated)`);
      } else {
        console.log(`❌ Member ${index + 1}: familyMembersCount is undefined (will NOT be updated)`);
      }
    });

    // Check the API update logic simulation
    console.log('\n🔄 Simulating API update logic:');
    for (const memberInfo of membersData) {
      if (memberInfo.familyMembersCount !== undefined) {
        console.log(`✅ Would update member ${memberInfo.memberId} with familyMembersCount: ${memberInfo.familyMembersCount}`);
      } else {
        console.log(`⏭️  Skipping family size update for member ${memberInfo.memberId} (undefined)`);
      }
    }

    console.log('\n✅ Family size debug analysis complete!');
    console.log('\n📋 Key findings:');
    console.log('1. Form should include familyMembersCount in members array');
    console.log('2. API expects memberInfo.familyMembersCount to be defined');
    console.log('3. Only members with defined familyMembersCount get updated');
    console.log('4. Check if MultiStepGroupForm properly maps familyMembersCount to submission data');

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Run the debug
debugFamilySizeStorage();
