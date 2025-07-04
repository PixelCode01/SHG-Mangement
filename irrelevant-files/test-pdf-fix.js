const fs = require('fs');

async function testPdfParseFix() {
  try {
    console.log('🧪 Testing PDF parsing fix...');
    
    // Test if pdf-parse works with our file
    const pdfPath = './public/swawlamban-may-2025.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found at:', pdfPath);
      return;
    }
    
    console.log('📄 Loading PDF file...');
    const buffer = fs.readFileSync(pdfPath);
    
    console.log(`📊 Buffer size: ${buffer.length} bytes`);
    
    // Test pdf-parse with minimal options
    try {
      const pdfParse = require('pdf-parse');
      
      console.log('🔍 Parsing with pdf-parse...');
      const data = await pdfParse(buffer, { max: 0 });
      
      console.log('✅ PDF parsing successful!');
      console.log(`📖 Text length: ${data.text.length} characters`);
      console.log(`📄 Pages: ${data.numpages}`);
      
      // Show first 500 characters
      console.log('\n📝 First 500 characters:');
      console.log('='.repeat(50));
      console.log(data.text.substring(0, 500));
      console.log('='.repeat(50));
      
      return { success: true, data };
      
    } catch (parseError) {
      console.log('❌ PDF parsing failed:', parseError.message);
      console.log('Error details:', parseError);
      return { success: false, error: parseError };
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return { success: false, error };
  }
}

testPdfParseFix().catch(console.error);
