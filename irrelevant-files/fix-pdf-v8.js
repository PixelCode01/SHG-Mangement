#!/usr/bin/env node

// Script to create a completely working V8 PDF extraction
const fs = require('fs');
const path = require('path');

console.log('🔧 Creating V8 PDF extraction fix...');

// Create the V8 function code
const v8FunctionCode = `
  // V8: Worker-free, CSP-compliant PDF processing
  const extractMembersFromPDFV8 = useCallback(async (file: File): Promise<MemberImportRow[]> => {
    console.log(\`🚀 [V8] Starting PDF extraction: \${file.name}, size: \${file.size} bytes\`);
    console.log('🔧 [V8] Worker-free, CSP-compliant PDF processing enabled');
    
    if (!file || !file.name) {
      console.error('❌ [V8] No file provided');
      throw new Error('No file provided');
    }
    
    try {
      let textContent = '';
      
      // Try binary extraction first (most reliable)
      try {
        console.log('📄 [V8] Attempting enhanced binary text extraction...');
        
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Method 1: Look for text patterns in PDF
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(uint8Array);
        
        // Extract text between parentheses (PDF text objects)
        const textMatches = rawText.match(/\\(([^)]*)\\)/g) || [];
        const extractedTexts = textMatches
          .map(match => match.slice(1, -1)) // Remove parentheses
          .filter(text => text.length > 1 && /[A-Za-z0-9]/.test(text));
        
        if (extractedTexts.length > 10) {
          textContent = extractedTexts.join('\\n');
          console.log(\`📝 [V8] Binary extraction successful: \${textContent.length} chars\`);
        } else {
          // Method 2: Raw ASCII extraction
          let asciiText = '';
          for (let i = 0; i < uint8Array.length; i++) {
            const char = uint8Array[i];
            if (char >= 32 && char <= 126) {
              asciiText += String.fromCharCode(char);
            } else if (char === 10 || char === 13) {
              asciiText += '\\n';
            }
          }
          
          textContent = asciiText
            .replace(/\\x00+/g, ' ')
            .replace(/[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F-\\xFF]/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim();
          
          console.log(\`📝 [V8] ASCII extraction: \${textContent.length} chars\`);
        }
        
      } catch (binaryError) {
        console.warn('⚠️ [V8] Binary extraction failed:', binaryError);
        throw binaryError;
      }
      
      // Validate we have some text
      if (textContent.length < 10) {
        throw new Error('Unable to extract meaningful text from PDF');
      }
      
      console.log(\`📤 [V8] Sending \${textContent.length} chars to text processor...\`);
      
      // Process the extracted text on the server
      const response = await fetch('/api/pdf-text-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textContent,
          fileName: file.name,
          fileSize: file.size,
          extractionMethod: 'v8-binary-extraction',
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(\`Text processing failed (\${response.status}): \${errorText}\`);
      }
      
      const result = await response.json();
      console.log(\`📥 [V8] Server response:\`, result);
      
      if (!result.success || !Array.isArray(result.members)) {
        throw new Error(result.error || 'Invalid response format from text processor');
      }
      
      // Transform server response to our format
      const members = result.members.map((member: any, index: number) => {
        const name = member.name || '';
        const loanAmount = Number(member.loanAmount) || 0;
        
        if (index < 3) {
          console.log(\`👤 [V8] Member \${index + 1}: "\${name}" - Loan: ₹\${loanAmount}\`);
        }
        
        return {
          name: name,
          loanAmount: loanAmount,
          'loan amount': loanAmount.toString(),
          email: member.email || '',
          phone: member.phone || '',
          memberNumber: '',
          accountNumber: '',
          personalContribution: 0,
          monthlyContribution: 0,
          joinedAt: new Date(),
        };
      });
      
      const totalMembers = members.length;
      const membersWithLoans = members.filter(m => m.loanAmount > 0).length;
      const totalLoanAmount = members.reduce((sum, m) => sum + m.loanAmount, 0);
      
      console.log(\`✅ [V8] Extraction complete: \${totalMembers} members, \${membersWithLoans} with loans, total: ₹\${totalLoanAmount.toLocaleString()}\`);
      
      return members;
      
    } catch (error) {
      console.error('❌ [V8] PDF extraction failed:', error);
      
      // Final fallback - return empty array with helpful message
      throw new Error(\`PDF extraction failed: \${error instanceof Error ? error.message : 'Unknown error'}. Please try a different PDF or enter members manually.\`);
    }
  }, []);
`;

console.log('✅ V8 function created');
console.log('📝 Function emphasizes binary extraction over PDF.js to avoid worker/CSP issues');
console.log('🔧 Next step: Replace the existing function in MultiStepGroupForm.tsx');
