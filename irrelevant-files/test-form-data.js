// Test script to check what data the periodic record form should receive
const groupId = '683959853e4e9e25dad41310';

console.log('=== TESTING PERIODIC RECORD FORM DATA ===\n');

// Simulate what the create page would receive
async function testFormData() {
  try {
    const url = `http://localhost:3003/api/groups/${groupId}`;
    console.log(`Fetching from: ${url}`);
    
    // This would normally require authentication, but let's test what the server expects
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // In a real app, this would include auth headers
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const groupData = await response.json();
      console.log('Raw group data from API:');
      console.log(JSON.stringify(groupData, null, 2));
      
      // Simulate the groupInitData calculation
      const totalCash = (groupData.cashInHand || 0) + (groupData.balanceInBank || 0);
      const totalLoanAmount = groupData.members?.reduce((sum, member) => {
        return sum + (member.currentLoanBalance || 0);
      }, 0) || 0;
      const totalGroupStanding = totalCash + totalLoanAmount;
      
      console.log('\n=== CALCULATED VALUES FOR FORM ===');
      console.log(`Total Cash: ₹${totalCash}`);
      console.log(`Total Loan Amount: ₹${totalLoanAmount}`);
      console.log(`Total Group Standing: ₹${totalGroupStanding}`);
      console.log(`Members Count: ${groupData.members?.length || 0}`);
      console.log(`Share per Member: ₹${(totalGroupStanding / (groupData.members?.length || 1)).toFixed(2)}`);
      
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// For now, let's just simulate based on the database data we know
const simulatedGroupData = {
  id: '683959853e4e9e25dad41310',
  name: 'bcv',
  collectionFrequency: 'MONTHLY',
  cashInHand: 1000,
  balanceInBank: 5000,
  monthlyContribution: 89,
  interestRate: 5,
  members: [
    { id: '1', name: 'SANTOSH MISHRA', currentLoanBalance: 10000 },
    { id: '2', name: 'ASHOK KUMAR KESHRI', currentLoanBalance: 20000 },
    { id: '3', name: 'ANUP KUMAR KESHRI', currentLoanBalance: 30000 },
    // ... other members with 0 loan balance
  ]
};

console.log('=== SIMULATED FORM INITIALIZATION ===');
const totalCash = simulatedGroupData.cashInHand + simulatedGroupData.balanceInBank;
const totalLoanAmount = simulatedGroupData.members.reduce((sum, member) => sum + member.currentLoanBalance, 0);
const totalGroupStanding = totalCash + totalLoanAmount;

console.log(`Group: ${simulatedGroupData.name}`);
console.log(`Cash in Hand: ₹${simulatedGroupData.cashInHand}`);
console.log(`Balance in Bank: ₹${simulatedGroupData.balanceInBank}`);
console.log(`Total Cash: ₹${totalCash}`);
console.log(`Total Loan Amount: ₹${totalLoanAmount}`);
console.log(`Total Group Standing: ₹${totalGroupStanding}`);
console.log(`Monthly Contribution per Member: ₹${simulatedGroupData.monthlyContribution}`);
console.log(`Interest Rate: ${simulatedGroupData.interestRate}%`);
console.log(`Collection Frequency: ${simulatedGroupData.collectionFrequency}`);

// Calculate expected interest earned for monthly collection
const monthlyInterestEarned = (totalLoanAmount * simulatedGroupData.interestRate) / 100 / 12;
console.log(`\nExpected Monthly Interest Earned: ₹${monthlyInterestEarned.toFixed(2)}`);

console.log('\n=== EXPECTED FORM VALUES ===');
console.log(`Standing at Start of Period: ₹${totalGroupStanding}`);
console.log(`Cash in Bank at End: ₹${simulatedGroupData.balanceInBank}`);
console.log(`Cash in Hand at End: ₹${simulatedGroupData.cashInHand}`);
console.log(`Interest Earned This Period: ₹${monthlyInterestEarned.toFixed(2)}`);
console.log(`Share of Each Member: Will be auto-calculated based on total standing`);

// Test the API call (will fail due to auth, but let's try)
testFormData();
