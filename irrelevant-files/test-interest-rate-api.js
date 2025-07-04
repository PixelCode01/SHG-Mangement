// Simple API test script
const testInterestRateAPI = async () => {
  try {
    console.log('Testing Interest Rate API...');
    
    const response = await fetch('http://localhost:3001/api/groups/684ab648ba9fb9c7e6784ca5/interest-rate', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        interestRate: 15
      })
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', [...response.headers.entries()]);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    if (response.ok) {
      console.log('✅ API call successful');
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
};

testInterestRateAPI();
