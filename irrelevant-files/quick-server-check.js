/**
 * Simple test to check if the development server is running and accessible
 */

const { chromium } = require('playwright');

async function checkServer() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Checking development server...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    const title = await page.title();
    console.log('✅ Page title:', title);
    
    // Check if we can navigate to the create group page
    console.log('🌐 Navigating to create group page...');
    await page.goto('http://localhost:3000/groups/create', { waitUntil: 'networkidle' });
    
    // Check for any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any console errors to appear
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      console.log('❌ Console errors found:');
      errors.forEach(error => console.log('  -', error));
    } else {
      console.log('✅ No console errors found');
    }
    
    // Look for the checkbox
    const checkbox = await page.locator('#lateFineEnabled').isVisible();
    console.log('✅ Late fine checkbox visible:', checkbox);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkServer().catch(console.error);
