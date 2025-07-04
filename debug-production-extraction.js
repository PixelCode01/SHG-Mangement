const fs = require('fs');
const FormData = require('form-data');

async function debugProductionExtraction() {
    try {
        console.log('=== DEBUGGING PRODUCTION EXTRACTION WITH LOGS ===\n');
        
        // Create a very simple test PDF request to see the logs
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        const formData = new FormData();
        formData.append('pdf', fs.createReadStream(pdfPath));
        
        console.log('🚀 Making request to production with debug...');
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://shg-mangement.vercel.app/api/pdf-upload-v18', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        console.log('\n📊 Response Status:', response.status);
        console.log('📋 Success:', result.success);
        console.log('📋 Message:', result.message);
        console.log('📋 Member Count:', result.memberCount);
        console.log('📋 Total Matches:', result.extractionDetails?.totalMatches);
        console.log('📋 Valid Members:', result.extractionDetails?.validMembers);
        console.log('📋 Extraction Method:', result.extractionMethod);
        console.log('📋 Text Length:', result.textLength);
        
        if (result.members && result.members.length > 0) {
            console.log('\n📋 First 5 members from production:');
            result.members.slice(0, 5).forEach((member, i) => {
                console.log(`   ${i + 1}. ${member.name} - ₹${member.loanAmount?.toLocaleString()}`);
            });
            
            // Search for SANTOSH
            const santoshMember = result.members.find(m => m.name.toLowerCase().includes('santosh'));
            if (santoshMember) {
                console.log(`\n✅ SANTOSH found in production: ${santoshMember.name}`);
            } else {
                console.log(`\n❌ SANTOSH NOT found in production members`);
            }
        }
        
        // Check the exact numbers
        if (result.extractionDetails) {
            console.log(`\n🔍 Extraction Analysis:`);
            console.log(`   Total matches found: ${result.extractionDetails.totalMatches}`);
            console.log(`   Valid members processed: ${result.extractionDetails.validMembers}`);
            console.log(`   Final member count: ${result.memberCount}`);
            
            if (result.extractionDetails.totalMatches > result.memberCount) {
                console.log(`   ⚠️ ${result.extractionDetails.totalMatches - result.memberCount} members were filtered out`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugProductionExtraction();
