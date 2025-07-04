const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

async function testDeploymentValidation() {
    console.log('🔍 DEPLOYMENT VALIDATION TEST');
    console.log('Testing for version markers and deployment status...');
    
    try {
        const pdfPath = './public/swawlamban-may-2025.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found:', pdfPath);
            return;
        }
        
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath), {
            filename: 'swawlamban-may-2025.pdf',
            contentType: 'application/pdf'
        });
        
        return new Promise((resolve, reject) => {
            const url = 'https://shg-mangement.vercel.app/api/pdf-parse-universal';
            
            const options = {
                method: 'POST',
                headers: form.getHeaders()
            };
            
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        console.log('📊 Response status:', res.statusCode);
                        
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            
                            console.log('\n🔍 DEPLOYMENT VALIDATION RESULTS:');
                            console.log('   Version:', result.version || 'NOT_FOUND');
                            console.log('   Deployment Check:', result.deploymentCheck || 'NOT_FOUND');
                            console.log('   Timestamp:', result.timestamp || 'NOT_FOUND');
                            console.log('   Debug Info Present:', result.debug ? 'YES' : 'NO');
                            console.log('   Members Found:', result.members ? result.members.length : 0);
                            
                            if (result.version === 'v3.2_DEPLOYMENT_TEST' && result.deploymentCheck === 'NEW_CODE_ACTIVE') {
                                console.log('\n✅ SUCCESS: New code is deployed!');
                                if (result.members && result.members.length > 0) {
                                    console.log('🎉 MEMBERS EXTRACTION WORKING!');
                                } else {
                                    console.log('⚠️  New code deployed but no members extracted - need to debug extraction logic');
                                }
                            } else {
                                console.log('\n❌ PROBLEM: Old code still deployed');
                                console.log('   - Version expected: v3.2_DEPLOYMENT_TEST');
                                console.log('   - Version received:', result.version || 'none');
                                console.log('   - This indicates Vercel cache/deployment issue');
                            }
                            
                            console.log('\n📄 Raw text sample:', result.text ? result.text.substring(0, 100) + '...' : 'none');
                            
                        } else {
                            console.log('❌ HTTP Error:', res.statusCode);
                            console.log('Response:', data.substring(0, 200));
                        }
                        resolve();
                    } catch (parseError) {
                        console.log('❌ Parse error:', parseError.message);
                        console.log('Raw response (first 200 chars):', data.substring(0, 200));
                        resolve();
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log('❌ Request error:', error.message);
                resolve();
            });
            
            form.pipe(req);
        });
        
    } catch (error) {
        console.log('❌ Test error:', error.message);
    }
}

testDeploymentValidation();
