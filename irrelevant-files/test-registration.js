const testRegistration = async () => {
  try {
    console.log('Testing phone registration...');
    
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'New Phone User',
        phone: '5559876543',
        password: 'testpass123',
        role: 'GROUP_LEADER'
      })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testRegistration();
