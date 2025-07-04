#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');

async function testSwawlambanAPI() {
    const fetch = (await import('node-fetch')).default;
    console.log('🧪 Testing SWAWLAMBAN PDF Parser API...\n');
    
    const pdfPath = '/home/pixel/Downloads/Swawlamban_Loan_Info.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.error('❌ PDF file not found:', pdfPath);
        return;
    }
    
    try {
        console.log('📄 Testing SWAWLAMBAN PDF Parser...');
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath));
        
        const response = await fetch('http://localhost:3003/api/pdf-parse-swawlamban', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
            return;
        }
        
        const result = await response.json();
        console.log('✅ SWAWLAMBAN Parser Response:');
        console.log('📊 Total members found:', result.members?.length || 0);
        
        if (result.members && result.members.length > 0) {
            const membersWithLoans = result.members.filter(m => 
                (m.loanAmount && m.loanAmount > 0) || 
                (m['loan amount'] && parseFloat(m['loan amount'].toString().replace(/[^\d.-]/g, '')) > 0)
            );
            
            console.log('💰 Members with loans:', membersWithLoans.length);
            
            // Show first few members
            console.log('\n📋 Sample members:');
            result.members.slice(0, 5).forEach((member, index) => {
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
    }
}

testSwawlambanAPI();
