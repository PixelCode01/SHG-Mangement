#!/usr/bin/env node

/**
 * Advanced PDF Analysis and Pattern Testing
 * This script analyzes the PDF content to improve extraction patterns
 */

const fs = require('fs');

async function analyzePDFContent() {
    console.log('🔍 ADVANCED PDF CONTENT ANALYSIS');
    console.log('==================================');
    
    const pdfPath = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.log('❌ PDF file not found:', pdfPath);
        return;
    }
    
    const fileBuffer = fs.readFileSync(pdfPath);
    console.log('📄 File size:', fileBuffer.length, 'bytes');
    
    // Try different encodings
    const encodings = ['utf8', 'latin1', 'ascii', 'utf16le'];
    
    for (const encoding of encodings) {
        console.log(`\n🔤 Testing encoding: ${encoding}`);
        try {
            const text = fileBuffer.toString(encoding);
            
            // Basic stats
            const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
            const digitCount = (text.match(/[0-9]/g) || []).length;
            const spaceCount = (text.match(/\s/g) || []).length;
            
            console.log(`📊 Stats - Alpha: ${alphaCount}, Digits: ${digitCount}, Spaces: ${spaceCount}`);
            console.log(`📝 Text length: ${text.length}`);
            
            // Look for common Indian name patterns
            const commonPatterns = [
                /[A-Z][a-z]{2,20}/g,  // Capitalized words
                /\b\w+\s+\w+\b/g,     // Two-word combinations
                /\d{1,3}\)/g,         // Numbers with parentheses (list items)
                /W\/O|D\/O|S\/O/gi,   // Relation indicators
            ];
            
            console.log('🔍 Pattern Analysis:');
            commonPatterns.forEach((pattern, i) => {
                const matches = text.match(pattern) || [];
                console.log(`  Pattern ${i + 1}: ${matches.length} matches`);
                if (matches.length > 0 && matches.length < 20) {
                    console.log(`    Samples: ${matches.slice(0, 5).join(', ')}`);
                }
            });
            
            // Show first few lines of readable text
            const lines = text.split('\n').filter(line => 
                line.trim().length > 0 && 
                (line.match(/[a-zA-Z]/g) || []).length > 3
            );
            
            if (lines.length > 0) {
                console.log('📃 First 10 readable lines:');
                lines.slice(0, 10).forEach((line, i) => {
                    console.log(`  ${i + 1}: ${line.trim().substring(0, 80)}...`);
                });
            }
            
            // Specific Indian name extraction attempts
            console.log('\n👤 Attempting Indian name extraction:');
            
            // Enhanced patterns for Indian names
            const indianNamePatterns = [
                // Pattern 1: Name followed by relation
                /(\w+(?:\s+\w+)*)\s+(?:W\/O|D\/O|S\/O|w\/o|d\/o|s\/o)\s+(\w+(?:\s+\w+)*)/gi,
                
                // Pattern 2: Number followed by name
                /\d+[\)\.]?\s*([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15})*)/g,
                
                // Pattern 3: Line starting with capital letter names
                /^([A-Z][a-z]{2,20}(?:\s+[A-Z][a-z]{1,20}){0,3})/gm,
                
                // Pattern 4: Names in list format
                /(\w+\s+\w+(?:\s+\w+)?)\s+(?:Age|age|AGE)?\s*:?\s*\d+/gi,
            ];
            
            const foundNames = new Set();
            
            indianNamePatterns.forEach((pattern, patternIndex) => {
                let match;
                let count = 0;
                while ((match = pattern.exec(text)) !== null && count < 20) {
                    const name = match[1]?.trim();
                    if (name && name.length > 2 && !foundNames.has(name.toLowerCase())) {
                        foundNames.add(name.toLowerCase());
                        console.log(`  Pattern ${patternIndex + 1}: ${name}`);
                        count++;
                    }
                }
            });
            
            if (foundNames.size === 0) {
                console.log('  ❌ No names found with standard patterns');
                
                // Try more relaxed search
                console.log('\n🔎 Trying relaxed word search:');
                const words = text.match(/\b[A-Z][a-z]{2,20}\b/g) || [];
                const uniqueWords = [...new Set(words)].slice(0, 20);
                console.log('  Capitalized words found:', uniqueWords.join(', '));
            }
            
        } catch (error) {
            console.log(`❌ Failed with ${encoding}:`, error.message);
        }
    }
}

// Run the analysis
analyzePDFContent().catch(console.error);
