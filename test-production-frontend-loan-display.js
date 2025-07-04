const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testProductionLoanDisplay() {
    console.log('🚀 Testing Production Frontend - Loan Amount Display');
    console.log('================================================\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable request interception to monitor API calls
        await page.setRequestInterception(true);
        let apiResponse = null;
        
        page.on('request', (request) => {
            console.log(`📡 Request: ${request.method()} ${request.url()}`);
            request.continue();
        });
        
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/pdf-upload-v18')) {
                console.log(`✅ API Response received: ${response.status()}`);
                try {
                    const responseData = await response.text();
                    apiResponse = JSON.parse(responseData);
                    console.log('📊 API Response Data:', JSON.stringify(apiResponse, null, 2));
                } catch (e) {
                    console.log('❌ Error parsing API response:', e.message);
                }
            }
        });
        
        // Navigate to production site
        console.log('🌐 Navigating to production site...');
        await page.goto('https://shg-mangement.vercel.app/', { waitUntil: 'networkidle2' });
        
        // Wait for page to load and look for "Create New Group" or similar
        await page.waitForTimeout(3000);
        
        // Try to find and click on create group or members section
        console.log('🔍 Looking for group creation or member management...');
        
        // Check if we need to navigate to a specific section
        const currentUrl = page.url();
        console.log(`📍 Current URL: ${currentUrl}`);
        
        // Look for navigation elements or forms
        const links = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a, button'));
            return allLinks.map(link => ({
                text: link.textContent?.trim(),
                href: link.href || link.getAttribute('href'),
                className: link.className
            })).filter(link => link.text);
        });
        
        console.log('🔗 Available links/buttons:');
        links.forEach(link => {
            console.log(`  - "${link.text}" -> ${link.href}`);
        });
        
        // Try to find group creation or member management
        let groupFormFound = false;
        
        // Look for specific text that might indicate group/member management
        const pageText = await page.evaluate(() => document.body.textContent);
        console.log('📄 Page contains group/member keywords:', 
            pageText.includes('group') || pageText.includes('member') || pageText.includes('PDF') || pageText.includes('upload'));
        
        // Try to find a form or navigate to groups page
        try {
            // Look for common navigation patterns
            const groupLink = await page.$('a[href*="group"], button:contains("group"), a:contains("group")');
            if (groupLink) {
                console.log('🎯 Found group-related link, clicking...');
                await groupLink.click();
                await page.waitForTimeout(2000);
                groupFormFound = true;
            }
        } catch (e) {
            console.log('ℹ️ No direct group link found, trying other approaches...');
        }
        
        // If we haven't found a group form, try direct navigation
        if (!groupFormFound) {
            console.log('🔄 Trying direct navigation to groups page...');
            try {
                await page.goto('https://shg-mangement.vercel.app/groups', { waitUntil: 'networkidle2' });
                await page.waitForTimeout(2000);
                groupFormFound = true;
            } catch (e) {
                console.log('⚠️ Groups page navigation failed, trying members page...');
                try {
                    await page.goto('https://shg-mangement.vercel.app/members', { waitUntil: 'networkidle2' });
                    await page.waitForTimeout(2000);
                } catch (e2) {
                    console.log('⚠️ Members page navigation also failed');
                }
            }
        }
        
        // Check if we can find the PDF upload form
        console.log('🔍 Looking for PDF upload functionality...');
        
        // Look for file input or PDF upload elements
        const fileInputs = await page.$$('input[type="file"]');
        console.log(`📁 Found ${fileInputs.length} file input(s)`);
        
        if (fileInputs.length > 0) {
            console.log('📤 Testing PDF upload with members.pdf...');
            
            // Check if members.pdf exists
            const pdfPath = '/home/pixel/Downloads/members.pdf';
            if (fs.existsSync(pdfPath)) {
                // Upload the PDF
                const fileInput = fileInputs[0];
                await fileInput.uploadFile(pdfPath);
                console.log('✅ PDF uploaded successfully');
                
                // Wait for processing
                await page.waitForTimeout(5000);
                
                // Look for member data or results
                console.log('🔍 Looking for extracted member data...');
                
                // Check for any tables, lists, or member displays
                const memberElements = await page.evaluate(() => {
                    // Look for common patterns where member data might be displayed
                    const tables = Array.from(document.querySelectorAll('table, .member, .loan, tr, li'));
                    const memberData = [];
                    
                    tables.forEach(element => {
                        const text = element.textContent?.trim();
                        if (text && (text.includes('₹') || text.includes('Rs') || text.includes('loan') || text.includes('amount'))) {
                            memberData.push({
                                tagName: element.tagName,
                                className: element.className,
                                text: text.substring(0, 200) // Limit text length
                            });
                        }
                    });
                    
                    return memberData;
                });
                
                console.log('💰 Found elements with loan/amount data:');
                memberElements.forEach((element, index) => {
                    console.log(`  ${index + 1}. ${element.tagName}.${element.className}: ${element.text}`);
                });
                
                // Check if we can find specific loan amounts
                const loanAmountPattern = /₹[\d,]+/g;
                const pageContent = await page.content();
                const foundAmounts = pageContent.match(loanAmountPattern) || [];
                
                console.log('💵 Found loan amounts on page:');
                foundAmounts.forEach((amount, index) => {
                    console.log(`  ${index + 1}. ${amount}`);
                });
                
                // Summary
                console.log('\n📊 SUMMARY:');
                console.log(`- API Response received: ${apiResponse ? 'YES' : 'NO'}`);
                console.log(`- Members in API response: ${apiResponse?.members?.length || 'N/A'}`);
                console.log(`- Loan amounts found on page: ${foundAmounts.length}`);
                console.log(`- Total loan in API: ${apiResponse?.totalLoanAmount || 'N/A'}`);
                
                if (apiResponse && foundAmounts.length > 0) {
                    console.log('✅ SUCCESS: Both API response and frontend display show loan amounts!');
                } else if (apiResponse && foundAmounts.length === 0) {
                    console.log('⚠️ ISSUE: API returns data but frontend doesn\'t display loan amounts');
                } else {
                    console.log('❌ ISSUE: No API response or frontend display');
                }
                
            } else {
                console.log('❌ members.pdf not found at expected location');
            }
        } else {
            console.log('❌ No file upload input found on the page');
        }
        
        // Keep browser open for manual inspection
        console.log('\n⏸️ Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        await browser.close();
    }
}

// Run the test
testProductionLoanDisplay().catch(console.error);
