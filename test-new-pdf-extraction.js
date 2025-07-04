#!/usr/bin/env node

/**
 * Test the new native PDF extraction approach (V26)
 * Tests both the v16 (pdfjs-dist multi-strategy) and v17 (native text extraction) endpoints
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTING NEW PDF EXTRACTION APPROACHES');
console.log('=========================================\n');

const testPDF = path.join(process.env.HOME, 'Downloads', 'members.pdf');

if (!fs.existsSync(testPDF)) {
  console.log('❌ Test PDF not found at:', testPDF);
  console.log('Please ensure members.pdf is available in ~/Downloads/');
  process.exit(1);
}

console.log('✅ Test PDF found:', testPDF);
console.log('📊 File size:', fs.statSync(testPDF).size, 'bytes\n');

// Test function for API endpoints
async function testEndpoint(endpoint, description) {
  console.log(`🔍 Testing ${endpoint} - ${description}`);
  console.log('='.repeat(50));
  
  try {
    // Create FormData equivalent
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testPDF), {
      filename: 'members.pdf',
      contentType: 'application/pdf'
    });
    
    console.log('📤 Uploading to:', `http://localhost:3000${endpoint}`);
    
    const response = await fetch(`http://localhost:3000${endpoint}`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success!');
      console.log(`📊 Members extracted: ${result.members?.length || 0}`);
      console.log(`📊 Extraction method: ${result.extractionMethod || 'unknown'}`);
      console.log(`📊 Text length: ${result.textLength || 0}`);
      
      if (result.members && result.members.length > 0) {
        console.log('\n👥 Extracted members (first 5):');
        result.members.slice(0, 5).forEach((member, i) => {
          console.log(`   ${i + 1}. ${member.name} - Share: ${member.currentShare || 0}, Loan: ${member.currentLoanAmount || 0}`);
        });
        
        if (result.members.length > 5) {
          console.log(`   ... and ${result.members.length - 5} more`);
        }
      }
    } else {
      console.log('❌ Failed!');
      const errorText = await response.text();
      console.log('Error:', errorText.substring(0, 200));
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  console.log('');
}

async function runTests() {
  // Start the development server first
  console.log('🚀 Starting development server...');
  const { spawn } = require('child_process');
  
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe'
  });
  
  // Wait for server to start
  await new Promise(resolve => {
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Ready') || data.toString().includes('Local:')) {
        resolve();
      }
    });
    
    setTimeout(resolve, 10000); // Fallback timeout
  });
  
  console.log('✅ Server started\n');
  
  // Test both endpoints
  await testEndpoint('/api/pdf-upload-v16', 'Multi-strategy with pdfjs-dist/pdf2json');
  await testEndpoint('/api/pdf-upload-v17', 'Native text extraction');
  
  // Test the original endpoint for comparison
  await testEndpoint('/api/pdf-upload-v15', 'Original pdf-parse approach');
  
  console.log('🎯 TESTING COMPLETE');
  console.log('Compare the results above to see which method works best');
  
  // Kill the server
  server.kill();
  process.exit(0);
}

// Check if we can reach the server or need to start it
async function checkServer() {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3000/api/pdf-upload-v17', {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('✅ Server is already running\n');
      // Run tests directly
      await testEndpoint('/api/pdf-upload-v16', 'Multi-strategy with pdfjs-dist/pdf2json');
      await testEndpoint('/api/pdf-upload-v17', 'Native text extraction');
      await testEndpoint('/api/pdf-upload-v15', 'Original pdf-parse approach');
      
      console.log('🎯 TESTING COMPLETE');
      console.log('Compare the results above to see which method works best');
    } else {
      console.log('⚠️ Server not running, please start with: npm run dev');
    }
  } catch (error) {
    console.log('⚠️ Server not reachable, please start with: npm run dev');
    console.log('Then run this test script again.');
  }
}

// Install required dependencies if needed
async function installDeps() {
  try {
    require('node-fetch');
    require('form-data');
  } catch (error) {
    console.log('📦 Installing required dependencies...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch form-data', { stdio: 'inherit' });
  }
}

// Run the test
async function main() {
  await installDeps();
  await checkServer();
}

main().catch(console.error);
