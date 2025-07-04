const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

async function testV4Local() {
    console.log('🧪 Testing local V4 PDF extraction endpoint...');
    
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
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/pdf-extract-v4',
                method: 'POST',
                headers: form.getHeaders()
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        console.log('📊 Response status:', res.statusCode);
                        
                        if (res.statusCode === 200) {
                            const result = JSON.parse(data);
                            console.log('✅ V4 endpoint response:');
                            console.log(`   Version: ${result.version}`);
                            console.log(`   Deployment Check: ${result.deploymentCheck}`);
                            console.log(`   Members found: ${result.members ? result.members.length : 0}`);
                            console.log(`   Debug info: ${result.debug ? 'present' : 'missing'}`);
                            
                            if (result.members && result.members.length > 0) {
                                console.log('🎉 SUCCESS! V4 endpoint working locally');
                                console.log('   First member:', result.members[0]);
                            } else {
                                console.log('❌ V4 endpoint not extracting members locally');
                            }
                        } else {
                            console.log('❌ HTTP Error:', res.statusCode);
                            console.log('Response:', data.substring(0, 200));
                        }
                        resolve();
                    } catch (parseError) {
                        console.log('❌ Parse error:', parseError.message);
                        console.log('Raw response (first 500 chars):', data.substring(0, 500));
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

testV4Local();
