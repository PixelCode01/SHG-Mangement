const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

async function testLocalPDF() {
    console.log('🧪 Testing local PDF parsing...');
    
    try {
        // Check if PDF file exists
        const pdfPath = './public/swawlamban-may-2025.pdf';
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found:', pdfPath);
            return;
        }
        
        console.log('📁 PDF file found, size:', fs.statSync(pdfPath).size, 'bytes');
        
        // Create form data
        const form = new FormData();
        form.append('file', fs.createReadStream(pdfPath), {
            filename: 'swawlamban-may-2025.pdf',
            contentType: 'application/pdf'
        });
        
        return new Promise((resolve, reject) => {
            // Make request to local API
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/pdf-parse-universal',
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
                            console.log('✅ Parsed response:');
                            console.log(`   Members found: ${result.members ? result.members.length : 0}`);
                            console.log(`   Debug info: ${result.debug ? 'present' : 'missing'}`);
                            
                            if (result.members && result.members.length > 0) {
                                console.log('🎉 SUCCESS! Members extracted:', result.members.length);
                                console.log('   First member:', result.members[0]);
                                console.log('   Last member:', result.members[result.members.length - 1]);
                            } else {
                                console.log('❌ FAILED! No members extracted');
                                if (result.debug) {
                                    console.log('🔍 Debug info:');
                                    console.log('   Text length:', result.debug.textLength);
                                    console.log('   Lines found:', result.debug.linesFound);
                                    console.log('   Lines after cleaning:', result.debug.linesAfterCleaning);
                                    console.log('   Pattern matches:', result.debug.patternMatches);
                                }
                            }
                        } else {
                            console.log('❌ HTTP Error:', res.statusCode);
                            console.log('Response:', data);
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
            
            // Write form data to request
            form.pipe(req);
        });
        
    } catch (error) {
        console.log('❌ Test error:', error.message);
    }
}

// Run the test
testLocalPDF();
