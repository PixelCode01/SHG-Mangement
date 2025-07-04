// This test script specifically checks our fix for the PDF metadata issue
// where "/Count" and "/Subtype /Type" were being interpreted as member names

console.log('🧪 Testing PDF metadata filter fix\n');

// Create mock data with problematic metadata entries
const mockMetadataRows = [
  { name: "/Count", 'loan amount': "2.00", loanAmount: 2 },
  { name: "/Subtype /Type", 'loan amount': "1.00", loanAmount: 1 },
  { name: "SANTOSH MISHRA", 'loan amount': "178604", loanAmount: 178604 },
  { name: "ANUP KUMAR KESHRI", 'loan amount': "2470000", loanAmount: 2470000 },
  { name: "/Type /Names", 'loan amount': "0.50", loanAmount: 0.5 },
  { name: "VIKKI THAKUR", 'loan amount': "30624", loanAmount: 30624 }
];

// This is the final safety check logic from our updated code
function applyMetadataFilter(members) {
  console.log(`Before filtering: ${members.length} members`);
  
  // FINAL SAFETY CHECK: Ensure no PDF metadata markers are in the results
  const finalMembers = members.filter(m => {
    const name = m.name || '';
    if (name.includes('/') || 
        name.includes('Type') || 
        name.includes('Subtype') ||
        name.includes('Count') ||
        name.includes('Object') ||
        /^\//.test(name)) {
      console.log(`🚫 Filtering out PDF metadata: "${name}"`);
      return false;
    }
    return true;
  });
  
  console.log(`After filtering: ${finalMembers.length} clean members`);
  console.log('\n📋 Filtered results:');
  finalMembers.forEach((m, i) => {
    console.log(`${i+1}. ${m.name} - ₹${m.loanAmount.toLocaleString()}`);
  });
  
  return finalMembers;
}

// Run the test
const filteredMembers = applyMetadataFilter(mockMetadataRows);

console.log('\n✅ TEST RESULTS:');
console.log('⚠️ Original problematic data:', mockMetadataRows.map(m => m.name).join(', '));
console.log('✅ Filtered correct data:', filteredMembers.map(m => m.name).join(', '));

// Check if the filter worked correctly
const metadataRemoved = mockMetadataRows.length - filteredMembers.length;
if (metadataRemoved === 3) {
  console.log('🎉 SUCCESS: All 3 metadata entries were properly filtered out!');
} else {
  console.log(`❌ FAILURE: Expected to filter out 3 metadata entries but got ${metadataRemoved}`);
}
