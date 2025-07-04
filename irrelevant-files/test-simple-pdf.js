#!/usr/bin/env node

const fs = require('fs');

async function testPDFParsing() {
    try {
        console.log('🧪 Testing PDF Parsing directly...\n');
        
        const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.error('❌ PDF file not found:', pdfPath);
            return;
        }
        
        // Import the parse function
        const { parseSwawlambanData } = require('./parse-swawlamban-pdf.js');
        
        // Read PDF file
        const pdfBuffer = fs.readFileSync(pdfPath);
        
        console.log('📄 Parsing PDF with enhanced patterns...');
        const result = await parseSwawlambanData(pdfBuffer);
        
        if (result && result.members) {
            console.log('✅ PDF parsed successfully!');
            console.log(`📊 Found ${result.members.length} members`);
            
            // Show first few members with loan amounts
            console.log('\n👥 Sample members:');
            result.members.slice(0, 5).forEach((member, index) => {
                console.log(`${index + 1}. ${member.name} - Loan: ₹${member.loanAmount || 0} (${member['loan amount'] || '0'})`);
            });
            
            // Count members with non-zero loans
            const membersWithLoans = result.members.filter(m => (m.loanAmount || 0) > 0);
            console.log(`\n💰 Members with loans: ${membersWithLoans.length}/${result.members.length}`);
            
            if (membersWithLoans.length > 0) {
                console.log('✅ Loan amounts are being parsed correctly!');
                console.log('\n💳 Members with highest loans:');
                membersWithLoans
                    .sort((a, b) => (b.loanAmount || 0) - (a.loanAmount || 0))
                    .slice(0, 3)
                    .forEach((member, index) => {
                        console.log(`${index + 1}. ${member.name} - ₹${member.loanAmount}`);
                    });
            } else {
                console.log('❌ No loan amounts parsed - the bug is still present');
            }
        } else {
            console.log('❌ PDF parsing failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testPDFParsing();
