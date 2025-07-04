#!/usr/bin/env node

// Advanced Buffer Text Extraction - Look for names in PDF stream data

console.log('🔍 ADVANCED BUFFER EXTRACTION - PDF Stream Analysis');
console.log('=' .repeat(80));

const fs = require('fs');

async function analyzeBufferTextAdvanced() {
    const testFile = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ Test PDF file not found:', testFile);
        return;
    }

    const buffer = fs.readFileSync(testFile);
    const bufferText = buffer.toString('utf8');
    
    console.log('📏 Buffer text length:', bufferText.length);
    console.log('');
    
    // Look for stream sections that might contain text
    console.log('🔍 SEARCHING FOR STREAMS AND TEXT CONTENT:');
    console.log('-' .repeat(60));
    
    // Find stream sections
    const streamMatches = bufferText.match(/stream([\s\S]*?)endstream/g);
    if (streamMatches) {
        console.log(`📦 Found ${streamMatches.length} stream sections`);
        
        streamMatches.forEach((stream, index) => {
            console.log(`\n📄 Stream ${index + 1}:`);
            const streamContent = stream.replace(/^stream/, '').replace(/endstream$/, '').trim();
            console.log(`   Length: ${streamContent.length} characters`);
            
            // Look for readable text in this stream
            const readableText = streamContent.match(/[A-Z\s]{10,}/g);
            if (readableText) {
                console.log('   📝 Readable text found:');
                readableText.forEach((text, i) => {
                    if (i < 5) { // Show first 5 matches
                        console.log(`      "${text.trim()}"`);
                    }
                });
                if (readableText.length > 5) {
                    console.log(`      ... and ${readableText.length - 5} more`);
                }
            }
            
            // Look for member names directly
            const memberNames = ['SANTOSH', 'ASHOK', 'ANUP', 'PRAMOD', 'MANOJ', 'VIKKI', 'SUNIL', 'PAWAN'];
            const foundInStream = [];
            
            memberNames.forEach(name => {
                if (streamContent.includes(name)) {
                    foundInStream.push(name);
                }
            });
            
            if (foundInStream.length > 0) {
                console.log(`   ✅ Found member names: ${foundInStream.join(', ')}`);
            }
        });
    }
    
    // Try alternative encodings
    console.log('\n🔧 TRYING ALTERNATIVE ENCODINGS:');
    console.log('-' .repeat(60));
    
    const encodings = ['latin1', 'binary', 'ascii'];
    
    for (const encoding of encodings) {
        try {
            const altText = buffer.toString(encoding);
            console.log(`\n📄 ${encoding.toUpperCase()} encoding (${altText.length} chars):`);
            
            const memberNames = ['SANTOSH', 'ASHOK', 'ANUP', 'PRAMOD', 'MANOJ'];
            const foundNames = [];
            
            memberNames.forEach(name => {
                if (altText.includes(name)) {
                    foundNames.push(name);
                    const index = altText.indexOf(name);
                    console.log(`   ✅ Found "${name}" at position ${index}`);
                    console.log(`      Context: "${altText.substring(index - 30, index + 50).replace(/[\x00-\x1F\x7F-\x9F]/g, '.')}"`);}
            });
            
            if (foundNames.length === 0) {
                // Show sample of this encoding
                const sample = altText.substring(1000, 1200).replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
                console.log(`   📝 Sample: "${sample}"`);
            }
            
        } catch (error) {
            console.log(`   ❌ Failed to decode with ${encoding}: ${error.message}`);
        }
    }
    
    console.log('');
    console.log('🏁 Advanced Buffer Analysis Complete!');
}

if (require.main === module) {
    analyzeBufferTextAdvanced().catch(console.error);
}
