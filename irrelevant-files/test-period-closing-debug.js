const fetch = require('node-fetch');

async function testPeriodClosingWithDebug() {
  console.log('🧪 Testing Period Closing with Debug Logs...\n');

  try {
    const groupId = '684805fbe1e16d8057f414ad'; // Test group
    
    // Create a simple period closing request
    const periodClosingData = {
      periodId: 'test-period-id', // This might need to be a real period ID
      memberContributions: [
        {
          memberId: 'test-member-id',
          lateFineAmount: 0
        }
      ],
      actualContributions: {
        'test-member-id': {
          totalPaid: 500,
          loanInterestPaid: 0
        }
      }
    };

    console.log('📤 Sending period closing request...');
    
    const response = await fetch(`http://localhost:3001/api/groups/${groupId}/contributions/periods/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will likely fail due to authentication, but we should see the debug logs
      },
      body: JSON.stringify(periodClosingData)
    });

    const result = await response.text();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response: ${result.substring(0, 200)}...`);

    if (response.status === 401) {
      console.log('\n✅ Expected 401 (authentication required)');
      console.log('🔍 Check the server console logs for our debugging output!');
    }

  } catch (error) {
    console.log('❌ Request failed (expected):', error.message);
    console.log('� Check the server console logs for our debugging output!');
  }
}

testPeriodClosingWithDebug();
