/**
 * Test script to verify conditional rendering behavior
 */

const { chromium } = require('playwright');

async function testConditionalRendering() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to create group page...');
    await page.goto('http://localhost:3000/groups/create');
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for late fine checkbox...');
    const checkbox = await page.locator('#lateFineEnabled');
    await checkbox.waitFor({ state: 'visible' });
    
    console.log('📊 Checking initial state...');
    const isInitiallyChecked = await checkbox.isChecked();
    console.log('Initial checkbox state:', isInitiallyChecked);
    
    // Look for the config section before clicking
    const configSection = page.locator('div:has-text("LATE FINE CONFIG IS NOW VISIBLE!")');
    const isVisibleBefore = await configSection.isVisible().catch(() => false);
    console.log('Config section visible before click:', isVisibleBefore);
    
    console.log('✅ Clicking the checkbox to enable late fine...');
    await checkbox.click();
    
    // Wait a bit for React to update
    await page.waitForTimeout(1000);
    
    console.log('📊 Checking state after click...');
    const isCheckedAfter = await checkbox.isChecked();
    console.log('Checkbox state after click:', isCheckedAfter);
    
    // Check if config section is now visible
    const isVisibleAfter = await configSection.isVisible().catch(() => false);
    console.log('Config section visible after click:', isVisibleAfter);
    
    if (isVisibleAfter) {
      console.log('✅ SUCCESS: Late fine config is now visible!');
      
      // Check if the rule type dropdown is also visible
      const ruleTypeSelect = page.locator('#lateFineRuleType');
      const isSelectVisible = await ruleTypeSelect.isVisible();
      console.log('Rule type dropdown visible:', isSelectVisible);
      
    } else {
      console.log('❌ PROBLEM: Config section is still not visible');
      
      // Check debug info
      const debugInfo = await page.locator('div:has-text("DEBUG lateFineEnabled:")').textContent().catch(() => 'Debug info not found');
      console.log('Debug info from page:', debugInfo);
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'late-fine-debug.png', fullPage: true });
      console.log('📸 Screenshot saved as late-fine-debug.png');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await browser.close();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testConditionalRendering().catch(console.error);
}

module.exports = { testConditionalRendering };
