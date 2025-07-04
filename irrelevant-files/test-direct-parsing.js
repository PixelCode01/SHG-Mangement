#!/usr/bin/env node

const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testDirectParsing() {
    console.log('🧪 Testing Direct PDF Parsing (No Server)...\n');
    
    const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.error('❌ PDF file not found:', pdfPath);
        return;
    }
    
    try {
        // Read PDF directly
        const dataBuffer = fs.readFileSync(pdfPath);
        console.log('📁 PDF file size:', dataBuffer.length, 'bytes');
        
        let pdfText = '';
        
        try {
            // Try pdf-parse first
            const data = await pdfParse(dataBuffer);
            pdfText = data.text;
            console.log('✅ PDF parsed with pdf-parse');
        } catch (error) {
            console.log('⚠️ pdf-parse failed:', error.message);
            
            // Fallback to our own text extraction logic
            const pdfString = dataBuffer.toString('binary');
            const matches = pdfString.match(/\(([^)]+)\)/g);
            if (matches) {
                pdfText = matches.map(m => m.slice(1, -1)).join(' ');
                console.log('✅ Extracted text using fallback method');
            } else {
                console.log('❌ No text could be extracted');
                return;
            }
        }
        
        console.log('📝 Extracted text length:', pdfText.length);
        console.log('📝 Sample text (first 500 chars):\n', pdfText.substring(0, 500), '\n');
        
        // Apply our enhanced parsing logic
        const members = parseEnhancedPDF(pdfText);
        
        console.log('✅ Enhanced parsing completed');
        console.log('📊 Total members found:', members.length);
        
        if (members.length > 0) {
            const membersWithLoans = members.filter(m => 
                (m.loanAmount && m.loanAmount > 0) || 
                (m['loan amount'] && parseFloat(m['loan amount'].toString().replace(/[^\d.-]/g, '')) > 0)
            );
            
            console.log('💰 Members with loans:', membersWithLoans.length);
            
            // Show first few members
            console.log('\n📋 Sample members:');
            members.slice(0, 5).forEach((member, index) => {
                console.log(`${index + 1}. Name: ${member.name || member['member name'] || 'N/A'}`);
                console.log(`   Loan Amount (number): ${member.loanAmount || 'N/A'}`);
                console.log(`   Loan Amount (string): ${member['loan amount'] || 'N/A'}`);
                console.log('');
            });
            
            // Show loan amount statistics
            if (membersWithLoans.length > 0) {
                const loanAmounts = membersWithLoans.map(m => {
                    const amount = m.loanAmount || parseFloat((m['loan amount'] || '0').toString().replace(/[^\d.-]/g, ''));
                    return amount;
                }).filter(amount => amount > 0);
                
                console.log('💰 Loan Amount Statistics:');
                console.log(`   Min: ₹${Math.min(...loanAmounts).toLocaleString()}`);
                console.log(`   Max: ₹${Math.max(...loanAmounts).toLocaleString()}`);
                console.log(`   Average: ₹${Math.round(loanAmounts.reduce((a, b) => a + b, 0) / loanAmounts.length).toLocaleString()}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

function parseEnhancedPDF(text) {
    console.log('🔍 Starting enhanced PDF parsing...');
    
    // Clean and normalize the text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Pattern 1: SWAWLAMBAN format - NAME followed by digits (concatenated)
    const swawlambanPattern = /([A-Za-z\s]+?)(\d{3,})/g;
    let matches = [];
    let match;
    
    console.log('🔍 Trying SWAWLAMBAN pattern...');
    while ((match = swawlambanPattern.exec(cleanText)) !== null) {
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Validate name (should have at least 2 characters and contain letters)
        if (name.length >= 2 && /[A-Za-z]/.test(name) && amount >= 0) {
            matches.push({
                name: name,
                loanAmount: amount,
                'loan amount': amount.toString()
            });
        }
    }
    
    if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} members using SWAWLAMBAN pattern`);
        return matches;
    }
    
    // Pattern 2: Standard table format
    console.log('🔍 Trying standard table pattern...');
    const lines = text.split('\n');
    const members = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for lines with name and amount
        const nameAmountMatch = line.match(/^(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/);
        if (nameAmountMatch) {
            const name = nameAmountMatch[1].trim();
            const amountStr = nameAmountMatch[2].replace(/,/g, '');
            const amount = parseFloat(amountStr);
            
            if (name.length >= 2 && amount >= 0) {
                members.push({
                    name: name,
                    loanAmount: amount,
                    'loan amount': amount.toString()
                });
            }
        }
    }
    
    if (members.length > 0) {
        console.log(`✅ Found ${members.length} members using standard table pattern`);
        return members;
    }
    
    console.log('⚠️ No members found with any pattern');
    return [];
}

testDirectParsing();
