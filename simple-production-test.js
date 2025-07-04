const https = require('https');
const fs = require('fs');

console.log('🚀 Simple Production API Test');
console.log('=' * 40);

async function testSimpleAPI() {
    return new Promise((resolve, reject) => {
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found');
            resolve(false);
            return;
        }
        
        const pdfBuffer = fs.readFileSync(pdfPath);
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 16);
        
        // Create multipart form data manually
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="pdf"; filename="members.pdf"',
            'Content-Type: application/pdf',
            '',
            pdfBuffer.toString('binary'),
            `--${boundary}--`
        ].join('\r\n');
        
        const options = {
            hostname: 'shg-mangement.vercel.app',
            port: 443,
            path: '/api/pdf-upload-v18',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData, 'binary')
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`📡 Status: ${res.statusCode}`);
                console.log(`📄 Response: ${data.substring(0, 500)}...`);
                
                try {
                    const result = JSON.parse(data);
                    if (result.success && result.members) {
                        console.log(`✅ SUCCESS: Found ${result.members.length} members`);
                        
                        const totalLoans = result.members.reduce((sum, member) => {
                            const loanAmount = parseFloat(member.loanAmount?.replace(/[₹,]/g, '') || '0');
                            return sum + loanAmount;
                        }, 0);
                        
                        console.log(`💰 Total Loans: ₹${totalLoans.toLocaleString('en-IN')}`);
                        console.log(`👥 Sample members:`);
                        result.members.slice(0, 3).forEach((member, i) => {
                            console.log(`   ${i+1}. ${member.name} - ${member.loanAmount || 'No loan'}`);
                        });
                    } else {
                        console.log(`❌ FAILED: ${result.error || 'Unknown error'}`);
                    }
                } catch (e) {
                    console.log(`❌ Parse error: ${e.message}`);
                }
                
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ Request error: ${error.message}`);
            resolve(false);
        });
        
        req.write(formData, 'binary');
        req.end();
    });
}

testSimpleAPI();
