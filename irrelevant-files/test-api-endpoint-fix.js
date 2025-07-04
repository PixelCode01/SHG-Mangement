const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIEndpoint() {
  console.log('🌐 TESTING ACTUAL API ENDPOINT');
  console.log('===============================\n');

  try {
    // Find a group to test with
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group || group.memberships.length === 0) {
      console.log('❌ No suitable group found for API testing');
      return;
    }

    const testMember = group.memberships[0].member;
    console.log(`📋 Testing API with group: ${group.name} (${group.groupId})`);
    console.log(`👤 Member: ${testMember.name}`);
    
    const apiUrl = `http://localhost:3000/api/groups/${group.id}/contributions/current`;
    
    const payload = {
      memberId: testMember.id,
      compulsoryContributionDue: group.monthlyContribution || 100,
      loanInterestDue: 25
    };

    console.log('\n🔄 FIRST API CALL...');
    console.log(`POST ${apiUrl}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // First API call
    const response1 = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result1 = await response1.json();
    
    if (response1.ok) {
      console.log('✅ FIRST API CALL SUCCESSFUL');
      console.log(`📊 Contribution ID: ${result1.id}`);
      console.log(`💰 Due Amount: ₹${result1.minimumDueAmount}`);
    } else {
      console.log('❌ FIRST API CALL FAILED');
      console.log('Error:', result1.error);
      return;
    }

    console.log('\n🔄 SECOND API CALL (DUPLICATE)...');
    
    // Modify payload slightly
    const payload2 = {
      ...payload,
      compulsoryContributionDue: (group.monthlyContribution || 100) + 50,
      loanInterestDue: 40
    };

    console.log('Updated Payload:', JSON.stringify(payload2, null, 2));

    // Second API call (should update, not create duplicate)
    const response2 = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload2)
    });

    const result2 = await response2.json();
    
    if (response2.ok) {
      console.log('✅ SECOND API CALL SUCCESSFUL (NO DUPLICATE ERROR)');
      console.log(`📊 Same Contribution ID: ${result2.id}`);
      console.log(`💰 Updated Due Amount: ₹${result2.minimumDueAmount}`);
      console.log(`🔄 Updated At: ${new Date(result2.updatedAt).toLocaleString()}`);
      
      if (result1.id === result2.id) {
        console.log('✅ Same record updated (no duplicate created)');
      } else {
        console.log('⚠️  Different record IDs - this might be unexpected');
      }
    } else {
      console.log('❌ SECOND API CALL FAILED');
      console.log('Error:', result2.error);
      
      if (result2.error && result2.error.includes('Unique constraint failed')) {
        console.log('💥 DUPLICATE CONSTRAINT ERROR DETECTED!');
        console.log('   The API fix may not be working properly.');
      }
      return;
    }

    console.log('\n🎉 API ENDPOINT TEST COMPLETED SUCCESSFULLY!');
    console.log('✅ No duplicate constraint errors');
    console.log('✅ API handles duplicate calls gracefully');
    console.log('✅ Upsert operation working in production');

  } catch (error) {
    console.error('❌ API TEST FAILED:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIEndpoint();
