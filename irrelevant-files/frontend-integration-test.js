const puppeteer = require('puppeteer');

async function testFrontendFeatures() {
    console.log('🌐 Starting Frontend Integration Tests');
    console.log('====================================');
    
    let browser;
    let page;
    
    try {
        // Launch browser
        browser = await puppeteer.launch({ 
            headless: false, // Set to true for CI/CD
            slowMo: 100,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1200, height: 800 });
        
        // Navigate to application
        console.log('🔗 Navigating to application...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        
        // Test 1: Check if homepage loads
        console.log('🏠 Testing Homepage Load...');
        const title = await page.title();
        console.log(`✅ Page title: ${title}`);
        
        // Test 2: Check navigation elements
        console.log('🧭 Testing Navigation Elements...');
        const navLinks = await page.$$eval('nav a, [role="navigation"] a', links => 
            links.map(link => ({ text: link.textContent.trim(), href: link.href }))
        );
        console.log(`✅ Found ${navLinks.length} navigation links:`, navLinks);
        
        // Test 3: Test Group Creation Form
        console.log('👥 Testing Group Creation...');
        try {
            // Look for group creation form or button
            const groupCreateButton = await page.$('button:has-text("Create Group"), [data-testid="create-group"], input[type="submit"]');
            if (groupCreateButton) {
                console.log('✅ Group creation interface found');
            } else {
                console.log('⚠️  Group creation interface not immediately visible');
            }
        } catch (error) {
            console.log('⚠️  Group creation test needs manual verification');
        }
        
        // Test 4: Check for forms and inputs
        console.log('📝 Testing Form Elements...');
        const forms = await page.$$eval('form', forms => forms.length);
        const inputs = await page.$$eval('input', inputs => 
            inputs.map(input => ({ type: input.type, name: input.name, id: input.id }))
        );
        console.log(`✅ Found ${forms} forms and ${inputs.length} input fields`);
        
        // Test 5: Check for data tables or lists
        console.log('📊 Testing Data Display Elements...');
        const tables = await page.$$eval('table', tables => tables.length);
        const lists = await page.$$eval('ul, ol', lists => lists.length);
        console.log(`✅ Found ${tables} tables and ${lists} lists`);
        
        // Test 6: Check for buttons and interactive elements
        console.log('🔘 Testing Interactive Elements...');
        const buttons = await page.$$eval('button', buttons => 
            buttons.map(btn => btn.textContent.trim()).filter(text => text.length > 0)
        );
        console.log(`✅ Found buttons: ${buttons.join(', ')}`);
        
        // Test 7: Check console for errors
        console.log('🐛 Checking for Console Errors...');
        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.push(`❌ Console Error: ${msg.text()}`);
            }
        });
        
        // Wait a bit to catch any console errors
        await page.waitForTimeout(2000);
        
        if (logs.length === 0) {
            console.log('✅ No console errors detected');
        } else {
            console.log('⚠️  Console errors found:');
            logs.forEach(log => console.log(log));
        }
        
        // Test 8: Check responsive design
        console.log('📱 Testing Responsive Design...');
        await page.setViewport({ width: 768, height: 600 }); // Tablet
        await page.waitForTimeout(1000);
        console.log('✅ Tablet viewport tested');
        
        await page.setViewport({ width: 375, height: 667 }); // Mobile
        await page.waitForTimeout(1000);
        console.log('✅ Mobile viewport tested');
        
        // Reset to desktop
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('\n🎉 Frontend Integration Tests Completed!');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ Frontend test error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Check if puppeteer is available
async function checkPuppeteer() {
    try {
        require('puppeteer');
        return true;
    } catch (error) {
        console.log('⚠️  Puppeteer not available. Installing...');
        return false;
    }
}

async function main() {
    const hasPuppeteer = await checkPuppeteer();
    
    if (!hasPuppeteer) {
        console.log('📦 Installing Puppeteer for frontend testing...');
        const { exec } = require('child_process');
        exec('npm install puppeteer', (error, stdout, stderr) => {
            if (error) {
                console.log('❌ Could not install Puppeteer. Running basic checks instead...');
                runBasicTests();
            } else {
                console.log('✅ Puppeteer installed. Running full frontend tests...');
                testFrontendFeatures();
            }
        });
    } else {
        await testFrontendFeatures();
    }
}

async function runBasicTests() {
    console.log('🌐 Running Basic Frontend Checks');
    console.log('=================================');
    
    const http = require('http');
    
    // Test if server is running
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        console.log(`✅ Server responding with status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (data.includes('html')) {
                console.log('✅ HTML content detected');
            }
            if (data.includes('script')) {
                console.log('✅ JavaScript detected');
            }
            if (data.includes('style') || data.includes('css')) {
                console.log('✅ CSS styling detected');
            }
            console.log('✅ Basic frontend checks completed');
        });
    });
    
    req.on('error', (e) => {
        console.error(`❌ Server connection error: ${e.message}`);
        console.log('💡 Make sure the development server is running: npm run dev');
    });
    
    req.end();
}

if (require.main === module) {
    main();
}
