const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

async function testV4Deployed() {
    console.log('🚀 Testing deployed V4 PDF extraction endpoint...');
    
    try {
        const pdfPath = './public/swawlamban-may-2025.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found:', pdfPath);
            return;
        }
        
        console.log('📁 PDF file found, size:', fs.statSync(pdfPath).size, 'bytes');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath), {
            filename: 'swawlamban-may-2025.pdf',
            contentType: 'application/pdf'
        });
        
        return new Promise((resolve, reject) => {
            const url = 'https://shg-mangement.vercel.app/api/pdf-extract-v4';
            
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
                            console.log('\n🎯 DEPLOYED V4 ENDPOINT RESULTS:');
                            console.log('   Version:', result.version || 'NOT_FOUND');
                            console.log('   Deployment Check:', result.deploymentCheck || 'NOT_FOUND');
                            console.log('   Timestamp:', result.timestamp || 'NOT_FOUND');
                            console.log('   Debug Info Present:', result.debug ? 'YES' : 'NO');
                            console.log('   Members Found:', result.members ? result.members.length : 0);
                            
                            if (result.version === 'v4.0_CACHE_BYPASS' && result.deploymentCheck === 'V4_ENDPOINT_ACTIVE') {
                                console.log('\n✅ SUCCESS: V4 endpoint deployed and active!');
                                if (result.members && result.members.length > 0) {
                                    console.log('🎉 MEMBERS EXTRACTION WORKING ON PRODUCTION!');
                                    console.log('   First member:', result.members[0]);
                                    console.log('   Total members:', result.members.length);
                                    console.log('\n🏆 PDF IMPORT ISSUE COMPLETELY RESOLVED!');
                                } else {
                                    console.log('⚠️  V4 deployed but no members extracted - need to debug');
                                    console.log('   Raw text sample:', result.text ? result.text.substring(0, 100) : 'none');
                                }
                            } else if (result.version) {
                                console.log('\n🔄 Different version deployed:');
                                console.log('   Expected: v4.0_CACHE_BYPASS');
                                console.log('   Received:', result.version);
                            } else {
                                console.log('\n❌ V4 endpoint not found or still old code');
                            }
                            
                        } else if (res.statusCode === 404) {
                            console.log('\n⏳ V4 endpoint not deployed yet (404)');
                            console.log('   Wait a few more minutes and try again');
                        } else {
                            console.log('\n❌ HTTP Error:', res.statusCode);
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

testV4Deployed();
