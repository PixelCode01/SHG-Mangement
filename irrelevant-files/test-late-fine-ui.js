// Test the late fine functionality in the group form
// This script will help debug the late fine config UI issue

console.log('Testing late fine configuration in group form...');

// Start the development server and check if it's running
const checkServer = async () => {
  try {
    const response = await fetch('http://localhost:3000');
    console.log('Development server is running:', response.status);
    return true;
  } catch (error) {
    console.log('Development server is not running:', error.message);
    return false;
  }
};

// Test function to check the form state
const testLateFineConfig = async () => {
  const isServerRunning = await checkServer();
  
  if (!isServerRunning) {
    console.log('Please start the development server first using: npm run dev');
    return;
  }
  
  console.log('\nTo test the late fine configuration:');
  console.log('1. Open http://localhost:3000 in your browser');
  console.log('2. Navigate to create new group or edit existing group');
  console.log('3. Look for "Enable Late Fine System" checkbox');
  console.log('4. Click the checkbox and check if the config options appear');
  console.log('5. Try different rule types and verify the conditional fields');
  
  console.log('\nExpected behavior:');
  console.log('- Checkbox unchecked: No late fine config should be visible');
  console.log('- Checkbox checked: Late fine rule type dropdown should appear');
  console.log('- Rule type "Fixed amount": Daily amount field should appear');
  console.log('- Rule type "Percentage": Daily percentage field should appear');
  console.log('- Rule type "Tier-based": Information about tier configuration should appear');
};

testLateFineConfig();
