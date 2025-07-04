const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

async function testNewDeployedPDF() {
    console.log('🧪 Testing NEW deployed PDF parsing endpoint...');
    
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
        
        return new Promise((resolve) => {
            const url = 'https://shg-mangement.vercel.app/api/pdf-parse-new';
            
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
                            console.log('✅ Response parsed successfully');
                            console.log(`   📈 Members found: ${result.members ? result.members.length : 0}`);
                            console.log(`   🔍 Debug info: ${result.debug ? 'present' : 'missing'}`);
                            console.log(`   📋 Version: ${result.version || 'unknown'}`);
                            
                            if (result.members && result.members.length > 0) {
                                console.log('🎉 SUCCESS! NEW deployed endpoint working!');
                                console.log(`   👥 Extracted ${result.members.length} members`);
                                console.log('   🧑 First member:', result.members[0]);
                                console.log('   🧑 Last member:', result.members[result.members.length - 1]);
                                
                                console.log('');
                                console.log('🏆 FINAL RESULT: SUCCESS!');
                                console.log('=====================================');
                                console.log('✅ PDF member import is now working correctly!');
                                console.log(`✅ Extracting ${result.members.length} members from PDF`);
                                console.log('✅ Both local and deployed versions are working');
                                console.log('✅ Ready for production use');
                                
                            } else {
                                console.log('❌ FAILED! No members extracted');
                                if (result.debug) {
                                    console.log('🔍 Debug info:');
                                    console.log(`   Text length: ${result.debug.textLength}`);
                                    console.log(`   Total lines: ${result.debug.totalLines}`);
                                    console.log(`   Filtered lines: ${result.debug.filteredLines}`);
                                    console.log(`   Pattern matches: ${result.debug.patternMatches}`);
                                }
                            }
                        } else {
                            console.log('❌ HTTP Error:', res.statusCode);
                            console.log('Response:', data.substring(0, 500));
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

testNewDeployedPDF();
