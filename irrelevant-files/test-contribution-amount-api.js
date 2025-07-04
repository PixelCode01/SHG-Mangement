// Test the contribution amount API
const testContributionAmountAPI = async () => {
  try {
    console.log('Testing Contribution Amount API...');
    
    const response = await fetch('http://localhost:3001/api/groups/684ab648ba9fb9c7e6784ca5/contribution-amount', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        monthlyContribution: 500
      })
    });
    
    console.log('Response Status:', response.status);
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    if (response.status === 401) {
      console.log('✅ API properly requires authentication (401 expected without cookies)');
    } else if (response.ok) {
      console.log('✅ API call successful');
    } else {
      console.log('❌ API call failed with unexpected error');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
};

testContributionAmountAPI();
