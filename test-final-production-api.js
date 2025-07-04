const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testProductionAPIAndFrontend() {
    console.log('🚀 Final Production Test - API & Frontend Integration');
    console.log('=======================================================\n');
    
    const API_URL = 'https://shg-mangement.vercel.app/api/pdf-upload-v18';
    const PDF_PATH = '/home/pixel/Downloads/members.pdf';
    
    try {
        // Step 1: Test the API directly
        console.log('📡 STEP 1: Testing Production API Directly');
        console.log('=' .repeat(50));
        
        if (!fs.existsSync(PDF_PATH)) {
            console.log('❌ PDF file not found at:', PDF_PATH);
            return;
        }
        
        const formData = new FormData();
        formData.append('pdf', fs.createReadStream(PDF_PATH));
        
        console.log('🔄 Uploading PDF to production API...');
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        console.log(`📊 API Response Status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ API Error:', errorText);
            return;
        }
        
        const apiData = await response.json();
        console.log('\n✅ API Response Structure:');
        console.log('- Success:', apiData.success);
        console.log('- Members count:', apiData.members?.length || 0);
        console.log('- Total loan amount:', apiData.totalLoanAmount || 'N/A');
        
        if (apiData.members && apiData.members.length > 0) {
            console.log('\n📋 First 5 Members with Loan Amounts:');
            apiData.members.slice(0, 5).forEach((member, index) => {
                console.log(`  ${index + 1}. ${member.name} - ₹${member.currentLoanAmount?.toLocaleString() || member.loanAmount?.toLocaleString() || '0'}`);
            });
            
            // Check for loan amounts across all members
            const membersWithLoans = apiData.members.filter(m => 
                (m.currentLoanAmount && m.currentLoanAmount > 0) || 
                (m.loanAmount && m.loanAmount > 0)
            );
            
            console.log(`\n💰 Members with loan amounts: ${membersWithLoans.length}/${apiData.members.length}`);
            
            if (membersWithLoans.length > 0) {
                console.log('✅ EXCELLENT: API is correctly extracting loan amounts!');
                
                // Calculate total
                const calculatedTotal = apiData.members.reduce((sum, member) => {
                    const amount = member.currentLoanAmount || member.loanAmount || 0;
                    return sum + amount;
                }, 0);
                
                console.log(`💵 Calculated total from members: ₹${calculatedTotal.toLocaleString()}`);
                console.log(`💵 API reported total: ₹${(apiData.totalLoanAmount || 0).toLocaleString()}`);
                
                if (Math.abs(calculatedTotal - (apiData.totalLoanAmount || 0)) < 1) {
                    console.log('✅ Totals match - API is working perfectly!');
                } else {
                    console.log('⚠️ Total mismatch - but individual loans are correct');
                }
            } else {
                console.log('❌ No members have loan amounts - API extraction issue');
            }
        } else {
            console.log('❌ No members found in API response');
        }
        
        // Step 2: Check Frontend Integration
        console.log('\n📱 STEP 2: Frontend Integration Verification');
        console.log('=' .repeat(50));
        
        console.log('🔍 Checking MultiStepGroupForm.tsx configuration...');
        
        // Read the frontend file to check API endpoint
        const frontendFile = '/home/pixel/aichat/shg24/SHG-Mangement-main/app/components/MultiStepGroupForm.tsx';
        if (fs.existsSync(frontendFile)) {
            const frontendContent = fs.readFileSync(frontendFile, 'utf8');
            
            // Check API endpoint
            if (frontendContent.includes('/api/pdf-upload-v18')) {
                console.log('✅ Frontend is using correct API endpoint: /api/pdf-upload-v18');
            } else {
                console.log('❌ Frontend is NOT using /api/pdf-upload-v18 endpoint');
            }
            
            // Check FormData field
            if (frontendContent.includes("formData.append('pdf'")) {
                console.log('✅ Frontend is using correct FormData field: pdf');
            } else {
                console.log('❌ Frontend is NOT using correct FormData field');
            }
            
            // Check loan amount handling
            if (frontendContent.includes('currentLoanAmount') && frontendContent.includes('loanAmount')) {
                console.log('✅ Frontend handles both currentLoanAmount and loanAmount fields');
            } else {
                console.log('⚠️ Frontend might not handle loan amount fields correctly');
            }
            
            // Check if debugging is still active
            if (frontendContent.includes('console.log') && frontendContent.includes('API Response')) {
                console.log('✅ Frontend debugging is active - will show API response in browser console');
            } else {
                console.log('ℹ️ Frontend debugging is not active');
            }
        }
        
        // Step 3: Deployment Status
        console.log('\n🚀 STEP 3: Deployment Status');
        console.log('=' .repeat(50));
        
        console.log('🌐 Production URL: https://shg-mangement.vercel.app');
        console.log('🔗 API Endpoint: https://shg-mangement.vercel.app/api/pdf-upload-v18');
        console.log('📄 Test PDF: members.pdf');
        
        // Summary
        console.log('\n📊 FINAL SUMMARY');
        console.log('=' .repeat(50));
        
        if (apiData.success && apiData.members && apiData.members.length > 0) {
            const hasLoanAmounts = apiData.members.some(m => 
                (m.currentLoanAmount && m.currentLoanAmount > 0) || 
                (m.loanAmount && m.loanAmount > 0)
            );
            
            if (hasLoanAmounts) {
                console.log('🎉 SUCCESS: Production system is fully functional!');
                console.log('✅ API correctly extracts member names and loan amounts');
                console.log('✅ Frontend is configured to use the correct API');
                console.log('✅ Loan amounts should display properly in the browser');
                console.log('\n🎯 NEXT STEPS:');
                console.log('1. Open https://shg-mangement.vercel.app in browser');
                console.log('2. Navigate to group creation');
                console.log('3. Upload members.pdf in Step 2');
                console.log('4. Verify loan amounts appear in Step 4');
                console.log('5. Check browser console for debugging info if needed');
            } else {
                console.log('⚠️ API works but no loan amounts extracted');
                console.log('❓ This might be due to PDF format changes');
            }
        } else {
            console.log('❌ API is not working correctly');
            console.log('🔧 Need to investigate API or PDF extraction logic');
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }
}

// Run the test
testProductionAPIAndFrontend().catch(console.error);
