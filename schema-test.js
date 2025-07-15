// Simple schema validation test
console.log('Testing schema fields...');

// Check if the schema file contains our new fields
const fs = require('fs');
const schemaContent = fs.readFileSync('./prisma/schema.prisma', 'utf8');

const fieldsToCheck = [
  'loanInsuranceBalance',
  'groupSocialBalance', 
  'includeDataTillCurrentPeriod',
  'currentPeriodMonth',
  'currentPeriodYear'
];

console.log('Checking for new fields in schema:');
fieldsToCheck.forEach(field => {
  if (schemaContent.includes(field)) {
    console.log(`✅ ${field} - Found in schema`);
  } else {
    console.log(`❌ ${field} - NOT found in schema`);
  }
});

console.log('\nSchema validation complete.');
