/**
 * Advanced Integration Test for Custom Columns Feature
 * Tests all advanced functionality including PDF import, templates, and schema management
 */

const { chromium } = require('playwright');
const path = require('path');

async function testCustomColumnsAdvanced() {
  console.log('🧪 Starting Advanced Custom Columns Test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Set to true for CI/CD
    slowMo: 500 // Slow down for better observation
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the application
    console.log('📱 Navigating to application...');
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Test 1: Navigate to Groups page
    console.log('🔍 Testing Groups navigation...');
    await page.click('text=Groups');
    await page.waitForLoadState('networkidle');
    
    // Test 2: Find a group and navigate to edit page
    console.log('📝 Testing Group edit page navigation...');
    const groupLinks = await page.locator('a[href*="/groups/"]').all();
    
    if (groupLinks.length === 0) {
      console.log('⚠️  No groups found. Creating a test group first...');
      await page.click('text=Create Group');
      await page.waitForLoadState('networkidle');
      
      // Fill basic group information
      await page.fill('input[name="name"]', 'Test Custom Columns Group');
      await page.fill('input[name="address"]', 'Test Address');
      await page.selectOption('select[name="organization"]', 'JSK');
      await page.fill('textarea[name="description"]', 'Test group for custom columns');
      
      // Submit the form
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      
      // Navigate back to groups list
      await page.click('text=Groups');
      await page.waitForLoadState('networkidle');
    }
    
    // Find and click on the first group's edit link
    const editLink = await page.locator('a[href*="/groups/"][href*="/edit"]').first();
    await editLink.click();
    await page.waitForLoadState('networkidle');
    
    // Test 3: Open Custom Columns Manager
    console.log('🎛️  Testing Custom Columns Manager opening...');
    await page.click('text=Advanced Options');
    await page.waitForSelector('text=Custom Columns & Properties', { timeout: 5000 });
    await page.click('text=Custom Columns & Properties');
    
    // Wait for the modal to appear
    await page.waitForSelector('[data-testid="custom-columns-manager"]', { timeout: 10000 });
    
    // Test 4: Test Template Selection
    console.log('📋 Testing Template Selection...');
    await page.click('text=Use Template');
    await page.waitForSelector('[data-testid="template-selector"]', { timeout: 5000 });
    
    // Select a template
    await page.click('[data-testid="template-basic-member-info"]');
    await page.click('text=Apply Template');
    
    // Test 5: Test Column Editor
    console.log('✏️  Testing Column Editor...');
    await page.click('text=Add Column');
    await page.waitForSelector('[data-testid="column-editor"]', { timeout: 5000 });
    
    // Fill column details
    await page.fill('input[name="name"]', 'Custom Test Field');
    await page.fill('input[name="label"]', 'Test Field Label');
    await page.selectOption('select[name="type"]', 'text');
    await page.fill('input[name="description"]', 'Test field description');
    
    // Save the column
    await page.click('text=Save Column');
    await page.waitForSelector('[data-testid="column-editor"]', { state: 'hidden', timeout: 5000 });
    
    // Test 6: Test PDF Import
    console.log('📄 Testing PDF Import functionality...');
    await page.click('text=Import from PDF');
    await page.waitForSelector('[data-testid="pdf-import"]', { timeout: 5000 });
    
    // Test file upload placeholder (since we can't actually upload files in this test)
    const fileInput = await page.locator('input[type="file"]');
    expect(await fileInput.count()).toBeGreaterThan(0);
    
    // Close PDF import modal
    await page.click('text=Cancel');
    await page.waitForSelector('[data-testid="pdf-import"]', { state: 'hidden', timeout: 5000 });
    
    // Test 7: Test Schema Preview
    console.log('👁️  Testing Schema Preview...');
    await page.click('text=Preview Schema');
    await page.waitForSelector('[data-testid="schema-preview"]', { timeout: 5000 });
    
    // Verify schema preview content
    const schemaContent = await page.textContent('[data-testid="schema-preview"]');
    expect(schemaContent).toContain('Custom Test Field');
    
    // Close schema preview
    await page.click('text=Close Preview');
    await page.waitForSelector('[data-testid="schema-preview"]', { state: 'hidden', timeout: 5000 });
    
    // Test 8: Test Bulk Editor
    console.log('🔄 Testing Bulk Editor...');
    await page.click('text=Bulk Edit');
    await page.waitForSelector('[data-testid="bulk-editor"]', { timeout: 5000 });
    
    // Test bulk operations
    await page.click('text=Select All');
    await page.click('text=Toggle Visibility');
    
    // Close bulk editor
    await page.click('text=Close Bulk Editor');
    await page.waitForSelector('[data-testid="bulk-editor"]', { state: 'hidden', timeout: 5000 });
    
    // Test 9: Save Schema
    console.log('💾 Testing Schema Save...');
    await page.click('text=Save Schema');
    
    // Wait for save confirmation
    await page.waitForSelector('text=Schema saved successfully', { timeout: 10000 });
    
    // Test 10: Close Custom Columns Manager
    console.log('❌ Testing Modal Close...');
    await page.click('text=Close');
    await page.waitForSelector('[data-testid="custom-columns-manager"]', { state: 'hidden', timeout: 5000 });
    
    console.log('✅ All Advanced Custom Columns Tests Passed!');
    
    return {
      success: true,
      message: 'Advanced Custom Columns Test completed successfully',
      tests: [
        '✅ Groups navigation',
        '✅ Group edit page navigation',
        '✅ Custom Columns Manager opening',
        '✅ Template Selection',
        '✅ Column Editor',
        '✅ PDF Import interface',
        '✅ Schema Preview',
        '✅ Bulk Editor',
        '✅ Schema Save',
        '✅ Modal Close'
      ]
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      message: `Test failed: ${error.message}`,
      error: error.stack
    };
  } finally {
    await browser.close();
  }
}

// Helper function to mock expect for basic assertions
function expect(actual) {
  return {
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    }
  };
}

// Run the test
testCustomColumnsAdvanced()
  .then(result => {
    console.log('\n📊 Test Results:');
    console.log(result.message);
    if (result.tests) {
      console.log('\n🧪 Completed Tests:');
      result.tests.forEach(test => console.log(`  ${test}`));
    }
    if (result.error) {
      console.error('\n❌ Error Details:');
      console.error(result.error);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
