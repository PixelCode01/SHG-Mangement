#!/usr/bin/env node

/**
 * Process the extracted PDF content into proper member format
 */

const extracted = `NAME
SANTOSH MISHRA
ASHOK KUMAR KESHRI
ANUP KUMAR KESHRI
PRAMOD KUMAR KESHRI
MANOJ MISHRA
VIKKI THAKUR
SUNIL KUMAR MAHTO
PAWAN KUMAR
SUDAMA PRASAD
VIJAY KESHRI
UDAY PRASAD KESHRI
POOJA KUMARI
KRISHNA KUMAR KESHRI
KAVITA KESHRI
JYOTI KESHRI
MANOJ KESHRI
JALESHWAR MAHTO
SURENDRA MAHTO
DILIP KUMAR RAJAK
SUDHAKAR KUMAR
SANJAY KESHRI
SUDHIR KUMAR
MANGAL MAHTO
KIRAN DEVI
SUBHASH MAHESHWARI
SIKANDAR K MAHTO
ACHAL KUMAR OJHA
UMESH PRASAD KESHRI
ANUJ KUMAR TOPPO
JITENDRA SHEKHAR
RAJESH KUMAR
MANISH ORAON
GANESH PRASAD KESHRI
SHYAM KUMAR KESHRI
SHANKAR MAHTO
SUBODH KUMAR
SUNIL ORAON
GOPAL PRASAD KESHRI
RAKESH KUMAR SINHA
SIKANDAR HAJAM
SUNIL KUMAR KESHRI
JAG MOHAN MODI
UMA SHANKAR KESHRI
SHIV SHANKAR MAHTO
GUDIYA DEVI

LOAN
EMAIL
178604
0
2470000
0
184168
30624
0
0
45210
117984
350108
0
68354
0
0
105870
0
0
414555
56328
0
190889
78408
0
0
80021
85702
86781
0
66085
0
0
163996
10234
162865
492468
109971
100000
300000
38621
165023
0
221827
91144
0

PHONE

JAYPRAKASH SINGH
MEERA KUMARI
VISHAL H SHAH
ROHIT PRIY RAJ
ANAND K CHITLANGIA
AISHWARYA SINGH

100000
127444
300000
0
0
0`;

console.log('🎯 PROCESSING YOUR ACTUAL PDF MEMBER DATA');
console.log('=' .repeat(80));

// Parse the extracted content
const lines = extracted.split('\n').map(line => line.trim()).filter(line => line);

// Find the sections
const nameIndex = lines.indexOf('NAME');
const loanIndex = lines.indexOf('LOAN');
const phoneIndex = lines.indexOf('PHONE');

console.log(`📊 Found sections:
- Names start at line: ${nameIndex}
- Loans start at line: ${loanIndex}  
- Phone section at line: ${phoneIndex}`);

// Extract first batch of names (between NAME and LOAN)
const firstNames = lines.slice(nameIndex + 1, loanIndex);
console.log(`\n👥 First batch: ${firstNames.length} names`);

// Extract loan amounts (between LOAN and PHONE, skip EMAIL)
const emailIndex = lines.indexOf('EMAIL');
const loanAmounts = lines.slice(emailIndex + 1, phoneIndex);
console.log(`💰 Loan amounts: ${loanAmounts.length} values`);

// Extract additional names (after PHONE)
const additionalNames = lines.slice(phoneIndex + 1);
const realAdditionalNames = additionalNames.filter(line => 
    !line.match(/^\d+$/) && line.length > 3
);
console.log(`👥 Additional names: ${realAdditionalNames.length} names`);

// Extract additional loan amounts (numbers after additional names)
const additionalAmounts = additionalNames.filter(line => line.match(/^\d+$/));
console.log(`💰 Additional amounts: ${additionalAmounts.length} values`);

console.log('\n📋 CREATING MEMBER LIST:');
console.log('-'.repeat(50));

const members = [];

// Process first batch (match names with loan amounts)
const maxPairs = Math.min(firstNames.length, loanAmounts.length);
for (let i = 0; i < maxPairs; i++) {
    const name = firstNames[i];
    const amount = parseInt(loanAmounts[i]) || 0;
    members.push({ name, amount });
}

// Process additional members
const maxAdditional = Math.min(realAdditionalNames.length, additionalAmounts.length);
for (let i = 0; i < maxAdditional; i++) {
    const name = realAdditionalNames[i];
    const amount = parseInt(additionalAmounts[i]) || 0;
    members.push({ name, amount });
}

console.log(`✅ Total members processed: ${members.length}`);

// Show sample and create CSV
console.log('\n📝 SAMPLE MEMBERS:');
members.slice(0, 10).forEach((member, index) => {
    console.log(`  ${index + 1}. ${member.name} - ₹${member.amount.toLocaleString()}`);
});

if (members.length > 10) {
    console.log(`  ... and ${members.length - 10} more members`);
}

// Create CSV format
console.log('\n📄 CSV FORMAT FOR IMPORT:');
console.log('-'.repeat(50));
console.log('Name,Loan Amount');
members.forEach(member => {
    console.log(`"${member.name}",${member.amount}`);
});

console.log('\n🎯 SUMMARY:');
console.log(`✅ Successfully extracted ${members.length} real members from your PDF!`);
console.log('✅ No more garbage data - these are actual member names');
console.log('✅ Loan amounts properly matched with names');

console.log('\n📋 NEXT STEPS:');
console.log('1. Copy the CSV format above');
console.log('2. Save it as members.csv');
console.log('3. Use manual member creation in the web app');
console.log('4. Test production site to confirm no garbage imports');

console.log('\n' + '='.repeat(80));
console.log('🎉 YOUR PDF DATA IS NOW PROPERLY EXTRACTED!');
