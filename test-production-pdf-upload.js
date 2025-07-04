#!/usr/bin/env node

/**
 * Test script to verify PDF upload endpoint works correctly
 * Tests the /api/pdf-upload-v17 endpoint directly
 */

const fs = require('fs');
const path = require('path');

async function testPDFUploadEndpoint() {
    console.log('🧪 TESTING PDF UPLOAD V17 ENDPOINT');
    console.log('====================================');
    
    // Test file path
    const pdfPath = '/home/pixel/Downloads/members.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.log('❌ Test PDF file not found:', pdfPath);
        return;
    }
    
    console.log('📄 Test file:', pdfPath);
    console.log('📦 File size:', fs.statSync(pdfPath).size, 'bytes');
    
    try {
        // Read file as buffer
        const fileBuffer = fs.readFileSync(pdfPath);
        
        // Create FormData equivalent
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: 'members.pdf',
            contentType: 'application/pdf'
        });
        
        console.log('\n📤 Making request to /api/pdf-upload-v17...');
        
        // Try local endpoint first (if server is running)
        const localEndpoint = 'http://localhost:3000/api/pdf-upload-v17';
        
        const response = await fetch(localEndpoint, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        }).catch(err => {
            console.log('⚠️  Local server not running, testing extraction logic directly...');
            return null;
        });
        
        if (response) {
            console.log('📊 Response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('\n✅ SUCCESS! Extracted members:');
                console.log('🔢 Total members found:', result.members.length);
                console.log('\n👥 First 10 members:');
                result.members.slice(0, 10).forEach((member, i) => {
                    console.log(`${i + 1}. ${member.name} (${member.father_husband || 'N/A'})`);
                });
                
                if (result.members.length > 10) {
                    console.log(`... and ${result.members.length - 10} more members`);
                }
                
                console.log('\n📈 Success! The endpoint is working correctly.');
            } else {
                const errorText = await response.text();
                console.log('❌ Error response:', errorText);
            }
        } else {
            // Test extraction logic directly if server not running
            console.log('\n🔧 Testing extraction logic directly...');
            await testExtractionDirectly(fileBuffer);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testExtractionDirectly(fileBuffer) {
    console.log('🔍 Testing native extraction logic...');
    
    // Import our extraction function (simulated)
    function extractMembersFromNativeBuffer(buffer) {
        try {
            // Try multiple encodings
            const encodings = ['utf8', 'latin1', 'ascii'];
            let bestText = '';
            let bestScore = 0;
            
            for (const encoding of encodings) {
                try {
                    const text = buffer.toString(encoding);
                    const score = (text.match(/[a-zA-Z]/g) || []).length;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestText = text;
                    }
                } catch (err) {
                    console.log(`⚠️  Failed to decode with ${encoding}:`, err.message);
                }
            }
            
            console.log('📝 Extracted text length:', bestText.length);
            console.log('📊 Text readability score:', bestScore);
            
            // Enhanced name pattern matching for Indian names
            const namePatterns = [
                // Standard Indian name patterns
                /\b([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,3})\s+(?:W\/O|D\/O|S\/O|w\/o|d\/o|s\/o)\s+([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,2})\b/g,
                /\b([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,3})\s+(?:Wife of|Daughter of|Son of)\s+([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,2})\b/gi,
                
                // Name followed by relation without keywords
                /\b([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,2})\s+([A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){0,2})\s*\d{1,3}\b/g,
                
                // Simple name patterns
                /\b[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{1,15}){1,3}\b/g,
            ];
            
            const members = [];
            const seenNames = new Set();
            
            for (const pattern of namePatterns) {
                let match;
                while ((match = pattern.exec(bestText)) !== null) {
                    let name, fatherHusband;
                    
                    if (match.length >= 3) {
                        // Has both name and relation
                        name = match[1].trim();
                        fatherHusband = match[2].trim();
                    } else {
                        // Just name
                        name = match[0].trim();
                        fatherHusband = '';
                    }
                    
                    // Clean and validate name
                    name = name.replace(/[^\w\s]/g, '').trim();
                    
                    // Skip if too short, already seen, or contains invalid patterns
                    if (name.length < 3 || 
                        seenNames.has(name.toLowerCase()) ||
                        /^\d+$/.test(name) ||
                        /(PDF|Page|Document|File|Date)/i.test(name)) {
                        continue;
                    }
                    
                    seenNames.add(name.toLowerCase());
                    
                    members.push({
                        name: name,
                        father_husband: fatherHusband || '',
                        mobile: '',
                        account_number: '',
                        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    });
                }
            }
            
            return members;
            
        } catch (error) {
            console.error('❌ Native extraction failed:', error.message);
            return [];
        }
    }
    
    const extractedMembers = extractMembersFromNativeBuffer(fileBuffer);
    
    console.log('\n📊 Direct extraction results:');
    console.log('🔢 Total members found:', extractedMembers.length);
    
    if (extractedMembers.length > 0) {
        console.log('\n👥 First 10 members:');
        extractedMembers.slice(0, 10).forEach((member, i) => {
            console.log(`${i + 1}. ${member.name} (${member.father_husband || 'N/A'})`);
        });
        
        if (extractedMembers.length > 10) {
            console.log(`... and ${extractedMembers.length - 10} more members`);
        }
    } else {
        console.log('❌ No valid members extracted');
    }
}

// Run the test
testPDFUploadEndpoint().catch(console.error);
