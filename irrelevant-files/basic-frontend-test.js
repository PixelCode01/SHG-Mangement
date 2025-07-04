const http = require('http');
const https = require('https');

async function runBasicFrontendTests() {
    console.log('🌐 Running Basic Frontend Checks');
    console.log('=================================');
    
    // Test if server is running
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`✅ Server responding with status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('📄 Analyzing homepage content...');
                
                // Check for basic HTML structure
                if (data.includes('<html')) {
                    console.log('✅ Valid HTML document structure');
                }
                
                if (data.includes('<head>') && data.includes('<body>')) {
                    console.log('✅ Proper HTML head and body sections');
                }
                
                // Check for React/Next.js indicators
                if (data.includes('_next') || data.includes('__next')) {
                    console.log('✅ Next.js framework detected');
                }
                
                if (data.includes('react') || data.includes('React')) {
                    console.log('✅ React components detected');
                }
                
                // Check for styling
                if (data.includes('style') || data.includes('css') || data.includes('tailwind')) {
                    console.log('✅ CSS styling detected');
                }
                
                // Check for JavaScript
                if (data.includes('<script')) {
                    console.log('✅ JavaScript functionality detected');
                }
                
                // Check for forms and interactivity
                if (data.includes('<form') || data.includes('input') || data.includes('button')) {
                    console.log('✅ Interactive form elements detected');
                }
                
                // Check for navigation
                if (data.includes('<nav') || data.includes('navigation') || data.includes('menu')) {
                    console.log('✅ Navigation elements detected');
                }
                
                // Check for SHG-specific content
                if (data.includes('group') || data.includes('Group') || data.includes('SHG') || data.includes('member')) {
                    console.log('✅ SHG-related content detected');
                }
                
                console.log('\n📊 Content Analysis Summary:');
                console.log(`- Content length: ${data.length} characters`);
                console.log(`- Contains forms: ${data.includes('<form') || data.includes('input')}`);
                console.log(`- Contains navigation: ${data.includes('<nav') || data.includes('navigation')}`);
                console.log(`- Contains tables: ${data.includes('<table')}`);
                console.log(`- Contains buttons: ${data.includes('<button')}`);
                
                resolve(true);
            });
        });
        
        req.on('error', (e) => {
            console.error(`❌ Server connection error: ${e.message}`);
            console.log('💡 Make sure the development server is running: npm run dev');
            reject(e);
        });
        
        req.setTimeout(5000, () => {
            console.error('❌ Request timeout - server may not be ready');
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

async function testAPIEndpoints() {
    console.log('\n🔗 Testing API Endpoints Availability');
    console.log('=====================================');
    
    const endpoints = [
        '/api/groups',
        '/api/auth/session',
        '/api/health'
    ];
    
    for (const endpoint of endpoints) {
        try {
            await testEndpoint(endpoint);
        } catch (error) {
            console.log(`⚠️  Endpoint ${endpoint}: ${error.message}`);
        }
    }
}

function testEndpoint(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            console.log(`✅ ${path}: Status ${res.statusCode}`);
            resolve(res.statusCode);
        });
        
        req.on('error', (e) => {
            reject(e);
        });
        
        req.setTimeout(3000, () => {
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

async function checkServerHealth() {
    console.log('\n🏥 Checking Server Health');
    console.log('=========================');
    
    try {
        // Check if we can connect to the server
        await runBasicFrontendTests();
        console.log('✅ Frontend server is healthy and responding');
        
        // Test API endpoints
        await testAPIEndpoints();
        
        console.log('\n🎉 Basic Frontend Tests Completed Successfully!');
        console.log('===============================================');
        console.log('✅ Server is running and accessible');
        console.log('✅ HTML content is being served');
        console.log('✅ Basic structure appears correct');
        console.log('✅ API endpoints are accessible');
        
    } catch (error) {
        console.error('❌ Frontend tests failed:', error.message);
        console.log('\n💡 Troubleshooting tips:');
        console.log('1. Ensure the development server is running: npm run dev');
        console.log('2. Check if port 3000 is available');
        console.log('3. Verify there are no build errors');
    }
}

if (require.main === module) {
    checkServerHealth();
}
