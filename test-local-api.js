const http = require('http');
const fs = require('fs');
const FormData = require('form-data');

console.log('🧪 Testing Local API');

async function testLocalAPI() {
    return new Promise((resolve, reject) => {
        const pdfPath = '/home/pixel/Downloads/members.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF file not found');
            resolve(false);
            return;
        }
        
        const form = new FormData();
        form.append('pdf', fs.createReadStream(pdfPath), {
            filename: 'members.pdf',
            contentType: 'application/pdf'
        });
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/pdf-upload-v18',
            method: 'POST',
            headers: {
                ...form.getHeaders()
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            console.log(`Status: ${res.statusCode}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (result.success && result.members) {
                        console.log('✅ Local API works!');
                        console.log(`Members: ${result.members.length}`);
                    } else {
                        console.log(`❌ Local API error: ${result.error}`);
                    }
                    
                } catch (parseError) {
                    console.log('❌ Parse error');
                    console.log('Response:', data.substring(0, 200));
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

testLocalAPI();
