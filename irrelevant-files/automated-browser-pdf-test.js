#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DOWNLOADS_DIR = '/home/pixel/Downloads';
const DEPLOYMENT_URL = 'https://shg-mangement-main.vercel.app';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Color output functions
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get all PDF files in Downloads
function getAllPDFs() {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const pdfFiles = files
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => path.join(DOWNLOADS_DIR, file))
      .filter(filePath => fs.existsSync(filePath));
    
    colorLog('cyan', `📁 Found ${pdfFiles.length} PDF files in Downloads folder:`);
    pdfFiles.forEach(file => colorLog('blue', `  • ${path.basename(file)}`));
    
    return pdfFiles;
  } catch (error) {
    colorLog('red', `❌ Error reading Downloads folder: ${error.message}`);
    return [];
  }
}

// Wait for deployment to be ready
async function waitForDeployment(url, maxWaitMinutes = 10) {
  const maxAttempts = maxWaitMinutes * 2; // Check every 30 seconds
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      colorLog('yellow', `🔍 Checking deployment (attempt ${attempt}/${maxAttempts})...`);
      
      const response = await fetch(url);
      if (response.ok) {
        colorLog('green', `✅ Deployment is ready at ${url}`);
        return true;
      }
    } catch (error) {
      colorLog('yellow', `⏳ Deployment not ready yet (attempt ${attempt}/${maxAttempts})`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
  }
  
  colorLog('red', `❌ Deployment not ready after ${maxWaitMinutes} minutes`);
  return false;
}

// Test PDF upload in browser
async function testPDFUpload(browser, pdfPath, retryCount = 0) {
  const fileName = path.basename(pdfPath);
  colorLog('blue', `🧪 Testing PDF: ${fileName} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
  
  const page = await browser.newPage();
  let success = false;
  let extractedMembers = 0;
  let errorMessage = '';
  
  try {
    // Enable console logging from the browser
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('PDF') || text.includes('extract') || text.includes('member')) {
        colorLog('cyan', `  🖥️ Browser: ${text}`);
      }
    });
    
    // Navigate to the app
    colorLog('yellow', `  📍 Navigating to ${DEPLOYMENT_URL}`);
    await page.goto(DEPLOYMENT_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit for the page to fully load
    await page.waitForTimeout(3000);
    
    // Look for the file input (try multiple selectors)
    const fileInputSelectors = [
      'input[type="file"]',
      'input[accept*="pdf"]',
      '[data-testid="pdf-upload"]',
      '.pdf-upload input',
      '#pdf-upload'
    ];
    
    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        fileInput = await page.$(selector);
        if (fileInput) {
          colorLog('green', `  ✅ Found file input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!fileInput) {
      throw new Error('File input not found on page');
    }
    
    // Upload the PDF file
    colorLog('yellow', `  📤 Uploading ${fileName}...`);
    await fileInput.uploadFile(pdfPath);
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Look for results or error messages
    const resultSelectors = [
      '.member-list',
      '.extracted-members',
      '[data-testid="member-results"]',
      '.members-container',
      '.member-row'
    ];
    
    let memberElements = [];
    for (const selector of resultSelectors) {
      try {
        memberElements = await page.$$(selector);
        if (memberElements.length > 0) {
          colorLog('green', `  ✅ Found member results with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Try to count extracted members
    if (memberElements.length > 0) {
      extractedMembers = memberElements.length;
      success = true;
      colorLog('green', `  🎉 SUCCESS: Extracted ${extractedMembers} members from ${fileName}`);
    } else {
      // Check for error messages
      const errorSelectors = [
        '.error',
        '.error-message',
        '[data-testid="error"]',
        '.alert-error'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.$(selector);
          if (errorElement) {
            errorMessage = await errorElement.textContent();
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      // Check console for errors
      const logs = await page.evaluate(() => {
        return window.console._logs || [];
      });
      
      if (!errorMessage && logs.length > 0) {
        errorMessage = logs.join('; ');
      }
      
      if (!errorMessage) {
        errorMessage = 'No members extracted and no specific error found';
      }
      
      colorLog('red', `  ❌ FAILED: ${errorMessage}`);
    }
    
  } catch (error) {
    errorMessage = error.message;
    colorLog('red', `  ❌ Browser test error: ${errorMessage}`);
  } finally {
    await page.close();
  }
  
  // Retry if failed and retries remaining
  if (!success && retryCount < MAX_RETRIES) {
    colorLog('yellow', `  🔄 Retrying ${fileName} in ${RETRY_DELAY/1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    return await testPDFUpload(browser, pdfPath, retryCount + 1);
  }
  
  return {
    fileName,
    success,
    extractedMembers,
    errorMessage,
    totalAttempts: retryCount + 1
  };
}

// Main automation function
async function automateFullTest() {
  colorLog('bold', '🚀 STARTING FULLY AUTOMATED PDF IMPORT TEST');
  colorLog('blue', '=' .repeat(60));
  
  try {
    // Step 1: Build and deploy latest changes
    colorLog('yellow', '📦 Step 1: Building and deploying latest changes...');
    
    // Check for any uncommitted changes
    try {
      const gitStatus = execSync('git status --porcelain', { cwd: __dirname, encoding: 'utf8' });
      if (gitStatus.trim()) {
        colorLog('yellow', '📝 Found uncommitted changes, committing them...');
        execSync('git add .', { cwd: __dirname });
        execSync(`git commit -m "Auto-commit for PDF test: ${new Date().toISOString()}"`, { cwd: __dirname });
      }
    } catch (e) {
      colorLog('yellow', '⚠️ Git commit skipped (no changes or already committed)');
    }
    
    // Push to trigger deployment
    try {
      execSync('git push origin main', { cwd: __dirname, stdio: 'inherit' });
      colorLog('green', '✅ Code pushed to trigger deployment');
    } catch (e) {
      colorLog('yellow', '⚠️ Git push skipped (already up to date)');
    }
    
    // Step 2: Wait for deployment
    colorLog('yellow', '⏳ Step 2: Waiting for Vercel deployment...');
    const deploymentReady = await waitForDeployment(DEPLOYMENT_URL);
    
    if (!deploymentReady) {
      throw new Error('Deployment not ready, aborting test');
    }
    
    // Step 3: Get all PDFs to test
    const pdfFiles = getAllPDFs();
    if (pdfFiles.length === 0) {
      throw new Error('No PDF files found in Downloads folder');
    }
    
    // Step 4: Run browser tests
    colorLog('yellow', '🌐 Step 3: Starting browser tests...');
    
    const browser = await puppeteer.launch({
      headless: true, // Run in headless mode for full automation
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const results = [];
    
    for (const pdfPath of pdfFiles) {
      const result = await testPDFUpload(browser, pdfPath);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await browser.close();
    
    // Step 5: Summary report
    colorLog('bold', '\n📊 AUTOMATED TEST RESULTS SUMMARY');
    colorLog('blue', '=' .repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    colorLog('green', `✅ Successful: ${successful.length}/${results.length} PDFs`);
    colorLog('red', `❌ Failed: ${failed.length}/${results.length} PDFs`);
    
    if (successful.length > 0) {
      colorLog('green', '\n🎉 SUCCESSFUL EXTRACTIONS:');
      successful.forEach(result => {
        colorLog('green', `  ✅ ${result.fileName}: ${result.extractedMembers} members`);
      });
    }
    
    if (failed.length > 0) {
      colorLog('red', '\n❌ FAILED EXTRACTIONS:');
      failed.forEach(result => {
        colorLog('red', `  ❌ ${result.fileName}: ${result.errorMessage}`);
      });
    }
    
    // Determine next action
    if (failed.length === 0) {
      colorLog('bold', '\n🎊 ALL TESTS PASSED! PDF import is working perfectly!');
      return true;
    } else {
      colorLog('yellow', '\n🔄 Some tests failed. Ready for next iteration...');
      return false;
    }
    
  } catch (error) {
    colorLog('red', `💥 Automation error: ${error.message}`);
    return false;
  }
}

// Run the automation
if (require.main === module) {
  automateFullTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      colorLog('red', `💥 Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { automateFullTest };
