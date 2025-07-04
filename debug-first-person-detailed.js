const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function debugFirstPersonExtraction() {
    console.log('🔍 DEBUG: First Person Import Issue');
    console.log('==================================\n');
    
    const API_URL = 'https://shg-mangement.vercel.app/api/pdf-upload-v18';
    const PDF_PATH = '/home/pixel/Downloads/members.pdf';
    
    try {
        if (!fs.existsSync(PDF_PATH)) {
            console.log('❌ PDF file not found at:', PDF_PATH);
            return;
        }
        
        const formData = new FormData();
        formData.append('pdf', fs.createReadStream(PDF_PATH));
        
        console.log('📤 Uploading PDF to get detailed extraction info...');
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        if (!response.ok) {
            console.log('❌ API Error:', response.status);
            return;
        }
        
        const apiData = await response.json();
        
        console.log('📊 API EXTRACTION RESULTS:');
        console.log('===========================');
        console.log(`- Success: ${apiData.success}`);
        console.log(`- Total members: ${apiData.members?.length || 0}`);
        console.log(`- Message: ${apiData.message}`);
        
        if (apiData.members && apiData.members.length > 0) {
            console.log('\n📋 FIRST 10 MEMBERS (as extracted by API):');
            console.log('==========================================');
            apiData.members.slice(0, 10).forEach((member, index) => {
                console.log(`${index + 1}. ${member.name} - ₹${(member.currentLoanAmount || member.loanAmount || 0).toLocaleString()}`);
            });
            
            // Check if specific names are present
            console.log('\n🔍 CHECKING FOR SPECIFIC NAMES:');
            console.log('===============================');
            
            const searchNames = ['SANTOSH', 'ASHOK', 'ANUP', 'PRAMOD', 'MANOJ', 'VIKKI'];
            searchNames.forEach(searchName => {
                const found = apiData.members.find(m => m.name.toUpperCase().includes(searchName));
                if (found) {
                    console.log(`✅ ${searchName}: Found as "${found.name}" - ₹${(found.currentLoanAmount || found.loanAmount || 0).toLocaleString()}`);
                } else {
                    console.log(`❌ ${searchName}: NOT FOUND`);
                }
            });
            
            // Check the actual order and see who should be first
            console.log('\n📊 MEMBER STATISTICS:');
            console.log('=====================');
            console.log(`- Members with loans: ${apiData.members.filter(m => (m.currentLoanAmount || m.loanAmount || 0) > 0).length}`);
            console.log(`- Members with ₹0 loans: ${apiData.members.filter(m => (m.currentLoanAmount || m.loanAmount || 0) === 0).length}`);
            
            // Find who has the highest loan to verify data quality
            const membersSorted = [...apiData.members].sort((a, b) => 
                (b.currentLoanAmount || b.loanAmount || 0) - (a.currentLoanAmount || a.loanAmount || 0)
            );
            
            console.log('\n💰 TOP 5 MEMBERS BY LOAN AMOUNT:');
            console.log('================================');
            membersSorted.slice(0, 5).forEach((member, index) => {
                console.log(`${index + 1}. ${member.name} - ₹${(member.currentLoanAmount || member.loanAmount || 0).toLocaleString()}`);
            });
            
        } else {
            console.log('❌ No members found in API response');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugFirstPersonExtraction().catch(console.error);
