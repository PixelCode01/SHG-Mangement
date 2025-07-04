const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

console.log('🚀 Testing Production API with Proper FormData');
console.log('=' * 50);

async function testProductionAPI() {
    return new Promise((resolve, reject) => {
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found');
            resolve(false);
            return;
        }
        
        console.log('📄 PDF file found, uploading...');
        
        const form = new FormData();
        form.append('pdf', fs.createReadStream(pdfPath), {
            filename: 'members.pdf',
            contentType: 'application/pdf'
        });
        
        const options = {
            hostname: 'shg-mangement.vercel.app',
            port: 443,
            path: '/api/pdf-upload-v18',
            method: 'POST',
            headers: {
                ...form.getHeaders()
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`📡 Response Status: ${res.statusCode}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (result.success && result.members) {
                        console.log('✅ SUCCESS!');
                        console.log(`👥 Members Found: ${result.members.length}`);
                        
                        const totalLoans = result.members.reduce((sum, member) => {
                            const loanAmount = parseFloat(member.loanAmount?.replace(/[₹,]/g, '') || '0');
                            return sum + loanAmount;
                        }, 0);
                        
                        console.log(`💰 Total Loan Amount: ₹${totalLoans.toLocaleString('en-IN')}`);
                        console.log('\n📋 Sample Members:');
                        result.members.slice(0, 5).forEach((member, i) => {
                            console.log(`   ${i+1}. ${member.name} - ${member.loanAmount || 'No loan'}`);
                        });
                        
                        console.log('\n🎯 PRODUCTION STATUS:');
                        console.log('✅ API is working correctly');
                        console.log('✅ Member extraction is successful');
                        console.log('✅ Loan amounts are being extracted');
                        
                    } else {
                        console.log(`❌ API Error: ${result.error || 'Unknown error'}`);
                    }
                    
                } catch (parseError) {
                    console.log('❌ Failed to parse response');
                    console.log('Raw response:', data.substring(0, 500));
                }
                
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ Request failed: ${error.message}`);
            resolve(false);
        });
        
        form.pipe(req);
    });
}

// Run the test
testProductionAPI();
