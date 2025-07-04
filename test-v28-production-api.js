const fs = require('fs');
const FormData = require('form-data');

async function testV28ProductionAPI() {
    try {
        console.log('=== TESTING V28 PRODUCTION API ===\n');
        
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        
        // Test with actual API
        const formData = new FormData();
        formData.append('pdf', fs.createReadStream(pdfPath));
        
        console.log('🚀 Calling production API...');
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://shg-mangement.vercel.app/api/pdf-upload-v18', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        console.log('\n📊 API Response Status:', response.status);
        console.log('📋 API Response:', JSON.stringify(result, null, 2));
        
        if (result.success && result.members) {
            console.log(`\n✅ SUCCESS: ${result.members.length} members extracted`);
            console.log(`💰 Total loan amount: ₹${result.totalLoanAmount?.toLocaleString()}`);
            
            console.log('\nFirst 10 members:');
            result.members.slice(0, 10).forEach((member, i) => {
                console.log(`   ${i + 1}. ${member.name} - ₹${member.loanAmount?.toLocaleString()}`);
            });
            
            // Check for SANTOSH MISHRA specifically
            const santoshMember = result.members.find(m => m.name.toLowerCase().includes('santosh'));
            if (santoshMember) {
                console.log(`\n✅ SANTOSH MISHRA FOUND: ${santoshMember.name} - ₹${santoshMember.loanAmount?.toLocaleString()}`);
            } else {
                console.log(`\n❌ SANTOSH MISHRA NOT FOUND in extracted members`);
            }
            
            if (result.members.length === 51) {
                console.log('\n🎉 PERFECT: All 51 members successfully extracted!');
            } else {
                console.log(`\n⚠️ Expected 51 members, got ${result.members.length}`);
            }
        } else {
            console.log('\n❌ API call failed:', result);
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

testV28ProductionAPI();
