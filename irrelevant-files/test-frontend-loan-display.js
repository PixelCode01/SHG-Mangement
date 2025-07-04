#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testFrontendLoanDisplay() {
  let browser;
  try {
    console.log('🔍 Testing frontend loan amount display...\n');

    // Launch browser
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigate to the periodic record page
    const url = 'http://localhost:3000/groups/6838012c22d510af47d80a33/periodic-records/68380450444de842c89f1827';
    console.log(`📱 Navigating to: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });

    // Wait for the table to load
    await page.waitForSelector('table', { timeout: 5000 });

    // Check if the loan amount columns are present
    const tableHeaders = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th'));
      return headers.map(h => h.textContent.trim());
    });

    console.log('📊 Table headers found:');
    tableHeaders.forEach((header, index) => {
      console.log(`   ${index + 1}. ${header}`);
    });

    // Check if loan-related headers are present
    const hasInitialLoanColumn = tableHeaders.some(h => h.includes('Initial Loan') || h.includes('Loan Amount'));
    const hasCurrentLoanColumn = tableHeaders.some(h => h.includes('Current') && h.includes('Loan'));

    console.log(`\n✅ Column Checks:`);
    console.log(`   Initial Loan Amount column: ${hasInitialLoanColumn ? '✅ Found' : '❌ Missing'}`);
    console.log(`   Current Loan Balance column: ${hasCurrentLoanColumn ? '✅ Found' : '❌ Missing'}`);

    // Get some sample member data to verify loan amounts are displayed
    const memberData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.slice(0, 3).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return cells.map(cell => cell.textContent.trim());
      });
    });

    console.log(`\n📋 Sample member data (first 3 rows):`);
    memberData.forEach((row, index) => {
      console.log(`   Row ${index + 1}: [${row.join(', ')}]`);
    });

    // Check for specific loan amounts in the table
    const pageText = await page.evaluate(() => document.body.textContent);
    const hasLoanAmounts = pageText.includes('₹5000') || pageText.includes('₹10000') || pageText.includes('₹2400') || pageText.includes('₹4800');

    console.log(`\n💰 Loan Amount Display Check:`);
    console.log(`   Contains loan amounts: ${hasLoanAmounts ? '✅ Found' : '❌ Missing'}`);

    if (hasLoanAmounts) {
      console.log('\n✅ SUCCESS: Loan amounts are being displayed in the frontend!');
    } else {
      console.log('\n❌ ISSUE: Loan amounts may not be displaying properly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  require('puppeteer');
  testFrontendLoanDisplay();
} catch (error) {
  console.log('📝 Puppeteer not available for automated testing.');
  console.log('🔍 Please manually check the browser at:');
  console.log('   http://localhost:3000/groups/6838012c22d510af47d80a33/periodic-records/68380450444de842c89f1827');
  console.log('\n✅ Expected features:');
  console.log('   - Initial Loan Amount column in the member details table');
  console.log('   - Current Loan Balance column in the member details table');
  console.log('   - SANTOSH MISHRA should show: Initial ₹5000, Current ₹2400');
  console.log('   - ASHOK KUMAR KESHRI should show: Initial ₹10000, Current ₹4800');
  console.log('   - ANUP KUMAR KESHRI should show: Initial ₹15000, Current ₹0');
}
