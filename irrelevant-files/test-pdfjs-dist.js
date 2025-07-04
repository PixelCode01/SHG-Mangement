// Test pdfjs-dist locally
const fs = require('fs');
const path = require('path');

async function testPdfjsDist() {
  try {
    console.log('Testing pdfjs-dist...');
    
    // Dynamic import for ES modules
    const pdfjs = await import('pdfjs-dist');
    console.log('✅ pdfjs-dist imported successfully');
    
    // Read the PDF file
    const pdfPath = '/home/pixel/Downloads/members.pdf';
    const buffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(buffer);
    
    console.log('📄 PDF file loaded, size:', uint8Array.length);
    
    // Load the PDF document
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    console.log(`📋 PDF loaded with ${pdf.numPages} pages`);
    
    let extractedText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      extractedText += pageText + '\\n';
    }
    
    console.log('✅ Text extracted successfully');
    console.log('📝 Total text length:', extractedText.length);
    console.log('📋 First 500 characters:', extractedText.substring(0, 500));
    
    // Look for names
    const lines = extractedText.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📋 Total lines found:', lines.length);
    console.log('📋 Sample lines:', lines.slice(0, 20));
    
  } catch (error) {
    console.error('❌ Error testing pdfjs-dist:', error);
  }
}

testPdfjsDist();
