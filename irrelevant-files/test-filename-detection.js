#!/usr/bin/env node

async function testFilenameDetection() {
    console.log('\n=== Testing Filename Detection Logic ===\n');
    
    // Test different filename variations
    const testFilenames = [
        'SWAWLAMBAN till may 2025.pdf',
        'swawlamban till may 2025.pdf',
        'Swawlamban till may 2025.pdf',
        'SWAWLAMBAN_till_may_2025.pdf',
        'some-other-file.pdf'
    ];
    
    testFilenames.forEach(filename => {
        const includesSwawlamban = filename.toLowerCase().includes('swawlamban');
        const apiEndpoint = includesSwawlamban ? '/api/pdf-parse-swawlamban' : '/api/pdf-parse';
        
        console.log(`📄 File: "${filename}"`);
        console.log(`  - toLowerCase(): "${filename.toLowerCase()}"`);
        console.log(`  - includes('swawlamban'): ${includesSwawlamban}`);
        console.log(`  - API endpoint: ${apiEndpoint}`);
        console.log(`  - Will use SWAWLAMBAN API: ${includesSwawlamban ? '✅ YES' : '❌ NO'}`);
        console.log('');
    });
    
    // Test the exact condition from the component
    const file = { name: 'SWAWLAMBAN till may 2025.pdf' };
    const condition = file.name.toLowerCase().includes('swawlamban');
    
    console.log('🔍 Component Condition Test:');
    console.log(`  - file.name: "${file.name}"`);
    console.log(`  - file.name.toLowerCase(): "${file.name.toLowerCase()}"`);
    console.log(`  - condition result: ${condition}`);
    
    if (condition) {
        console.log('  - ✅ Should use SWAWLAMBAN API');
    } else {
        console.log('  - ❌ Will NOT use SWAWLAMBAN API');
    }
}

testFilenameDetection();
