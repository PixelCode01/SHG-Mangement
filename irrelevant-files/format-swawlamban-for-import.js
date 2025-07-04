const fs = require('fs');

// Read the parsed SWAWLAMBAN data
const swawlambanData = JSON.parse(fs.readFileSync('./swawlamban-parsed-data.json', 'utf8'));

console.log('📊 Converting SWAWLAMBAN data for import...');
console.log(`Total members to convert: ${swawlambanData.members.length}`);

// Format data for the import API
const membersForImport = swawlambanData.members.map(member => ({
  Name: member.name,
  Email: null, // Not available in the PDF
  Phone: null, // Not available in the PDF
  Address: null, // Not available in the PDF
  LoanAmount: member.loanAmount > 0 ? member.loanAmount : null // Only include loan amount if > 0
}));

// Save the formatted data
const importData = {
  members: membersForImport
};

fs.writeFileSync('./swawlamban-import-ready.json', JSON.stringify(importData, null, 2));

console.log('✅ Data formatted and saved to swawlamban-import-ready.json');
console.log('\n📋 Sample of formatted data:');
console.log('='.repeat(60));

// Show first 5 members as example
for (let i = 0; i < Math.min(5, membersForImport.length); i++) {
  const member = membersForImport[i];
  console.log(`${i+1}. Name: "${member.Name}"`);
  console.log(`   LoanAmount: ${member.LoanAmount ? `₹${member.LoanAmount.toLocaleString()}` : 'null'}`);
  console.log('');
}

console.log(`\n📊 Summary:`);
console.log(`- Total members: ${membersForImport.length}`);
console.log(`- Members with loans: ${membersForImport.filter(m => m.LoanAmount !== null).length}`);
console.log(`- Members without loans: ${membersForImport.filter(m => m.LoanAmount === null).length}`);

console.log('\n🚀 Ready for import! You can now:');
console.log('1. Start your development server: npm run dev');
console.log('2. Navigate to the members import page');
console.log('3. Upload the swawlamban-import-ready.json file');
console.log('   OR');
console.log('4. Use the API directly with the formatted JSON data');
