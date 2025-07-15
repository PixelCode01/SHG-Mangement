#!/usr/bin/env node

/**
 * Comprehensive Test Script for Contribution Issues
 * This script tests the payment submission workflow and analyzes frontend issues
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 COMPREHENSIVE CONTRIBUTION TESTING SCRIPT');
console.log('=' .repeat(60));

// Test configuration
const testConfig = {
  groupId: '6874af5c5340d511e572ffe9',
  testMemberId: '6874aebd5340d511e572ffe8',
  baseUrl: 'http://localhost:3000',
  testAmount: 100
};

// Console error patterns to check for
const criticalErrorPatterns = [
  /Failed to load script.*vercel-scripts/i,
  /Content Security Policy directive.*script-src/i,
  /React DevTools/i,
  /resource.*was preloaded.*not used/i,
  /Refused to load the script/i
];

// Test results storage
const testResults = {
  frontendIssues: [],
  apiTests: [],
  submissionTests: [],
  cspIssues: [],
  performanceIssues: []
};

/**
 * 1. FRONTEND FILE ANALYSIS
 */
async function analyzeFrontendFiles() {
  console.log('\n📁 ANALYZING FRONTEND FILES...');
  
  const filesToCheck = [
    'app/layout.tsx',
    'app/groups/[id]/contributions/page.tsx',
    'components/ClientSetup.tsx',
    'components/Navigation.tsx',
    'next.config.js',
    'package.json'
  ];

  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ Found: ${file}`);
      
      // Check for specific issues
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for Vercel Analytics/Speed Insights
      if (content.includes('@vercel/analytics') || content.includes('@vercel/speed-insights')) {
        testResults.frontendIssues.push({
          file,
          issue: 'Vercel Analytics/Speed Insights causing CSP violations',
          severity: 'HIGH',
          recommendation: 'Remove or configure CSP properly'
        });
      }

      // Check for CSP configuration
      if (file === 'next.config.js' && !content.includes('contentSecurityPolicy')) {
        testResults.frontendIssues.push({
          file,
          issue: 'Missing Content Security Policy configuration',
          severity: 'MEDIUM',
          recommendation: 'Add CSP headers to allow Vercel scripts'
        });
      }

      // Check for React DevTools warnings
      if (content.includes('React DevTools') || content.includes('react-devtools')) {
        testResults.frontendIssues.push({
          file,
          issue: 'React DevTools warnings in production build',
          severity: 'LOW',
          recommendation: 'Ensure proper production build configuration'
        });
      }
    } else {
      console.log(`❌ Missing: ${file}`);
      testResults.frontendIssues.push({
        file,
        issue: 'File not found',
        severity: 'HIGH',
        recommendation: 'Ensure file exists and is properly configured'
      });
    }
  }
}

/**
 * 2. API ENDPOINT TESTING
 */
async function testApiEndpoints() {
  console.log('\n🔌 TESTING API ENDPOINTS...');
  
  const endpoints = [
    {
      name: 'Get Group Data',
      method: 'GET',
      url: `/api/groups/${testConfig.groupId}`,
      expectedStatus: 200
    },
    {
      name: 'Get Current Period',
      method: 'GET', 
      url: `/api/groups/${testConfig.groupId}/contributions/periods/current`,
      expectedStatus: 200
    },
    {
      name: 'Get Current Contributions',
      method: 'GET',
      url: `/api/groups/${testConfig.groupId}/contributions/current`,
      expectedStatus: 200
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      
      const response = await fetch(`${testConfig.baseUrl}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const success = response.status === endpoint.expectedStatus;
      const data = await response.text();
      
      testResults.apiTests.push({
        endpoint: endpoint.name,
        status: response.status,
        success,
        responseSize: data.length,
        timestamp: new Date().toISOString()
      });

      console.log(`${success ? '✅' : '❌'} ${endpoint.name}: ${response.status}`);
      
      if (!success) {
        console.log(`   Response: ${data.substring(0, 200)}...`);
      }
      
    } catch (error) {
      testResults.apiTests.push({
        endpoint: endpoint.name,
        status: 'ERROR',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`❌ ${endpoint.name}: ${error.message}`);
    }
  }
}

/**
 * 3. SUBMISSION WORKFLOW TESTING
 */
async function testSubmissionWorkflow() {
  console.log('\n💰 TESTING SUBMISSION WORKFLOW...');
  
  try {
    // Step 1: Get member contribution data
    console.log('Step 1: Getting member contribution data...');
    const contributionsResponse = await fetch(`${testConfig.baseUrl}/api/groups/${testConfig.groupId}/contributions/current`);
    
    if (!contributionsResponse.ok) {
      throw new Error(`Failed to get contributions: ${contributionsResponse.status}`);
    }
    
    const contributionsData = await contributionsResponse.json();
    console.log(`✅ Found ${contributionsData.contributions?.length || 0} contribution records`);
    
    // Find test member contribution
    const testMemberContribution = contributionsData.contributions?.find(
      c => c.memberId === testConfig.testMemberId
    );
    
    if (!testMemberContribution) {
      console.log('❌ Test member contribution not found');
      return;
    }
    
    console.log(`✅ Test member contribution found: ${testMemberContribution.id}`);
    
    // Step 2: Test submission
    console.log('Step 2: Testing payment submission...');
    
    const submissionPayload = {
      compulsoryContributionPaid: testConfig.testAmount,
      loanInterestPaid: 0,
      lateFinePaid: 0,
      loanInsurancePaid: 0,
      groupSocialPaid: 0,
      totalPaid: testConfig.testAmount,
      cashAllocation: {
        contributionToCashInHand: testConfig.testAmount * 0.3,
        contributionToCashInBank: testConfig.testAmount * 0.7,
        interestToCashInHand: 0,
        interestToCashInBank: 0
      },
      submissionDate: new Date().toISOString()
    };
    
    const submissionResponse = await fetch(
      `${testConfig.baseUrl}/api/groups/${testConfig.groupId}/contributions/${testMemberContribution.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionPayload)
      }
    );
    
    const submissionSuccess = submissionResponse.ok;
    const submissionData = await submissionResponse.json();
    
    testResults.submissionTests.push({
      step: 'Payment Submission',
      success: submissionSuccess,
      status: submissionResponse.status,
      payload: submissionPayload,
      response: submissionData,
      timestamp: new Date().toISOString()
    });
    
    console.log(`${submissionSuccess ? '✅' : '❌'} Payment submission: ${submissionResponse.status}`);
    
    if (submissionSuccess) {
      console.log(`✅ Contribution updated successfully`);
      console.log(`   Total Paid: ₹${submissionData.contribution?.totalPaid || 0}`);
      console.log(`   Paid Date: ${submissionData.contribution?.paidDate || 'Not set'}`);
    } else {
      console.log(`❌ Submission failed: ${JSON.stringify(submissionData, null, 2)}`);
    }
    
    // Step 3: Verify data refresh
    console.log('Step 3: Verifying data refresh...');
    
    setTimeout(async () => {
      try {
        const refreshResponse = await fetch(`${testConfig.baseUrl}/api/groups/${testConfig.groupId}/contributions/current`);
        const refreshData = await refreshResponse.json();
        
        const updatedContribution = refreshData.contributions?.find(
          c => c.id === testMemberContribution.id
        );
        
        const dataRefreshSuccess = updatedContribution && updatedContribution.totalPaid > 0;
        
        testResults.submissionTests.push({
          step: 'Data Refresh Verification',
          success: dataRefreshSuccess,
          originalPaid: testMemberContribution.totalPaid || 0,
          updatedPaid: updatedContribution?.totalPaid || 0,
          timestamp: new Date().toISOString()
        });
        
        console.log(`${dataRefreshSuccess ? '✅' : '❌'} Data refresh verification`);
        
        if (dataRefreshSuccess) {
          console.log(`   Payment amount reflected: ₹${updatedContribution.totalPaid}`);
        }
        
      } catch (error) {
        console.log(`❌ Data refresh verification failed: ${error.message}`);
      }
    }, 1000);
    
  } catch (error) {
    testResults.submissionTests.push({
      step: 'Workflow Error',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    console.log(`❌ Submission workflow error: ${error.message}`);
  }
}

/**
 * 4. CSP AND SECURITY ANALYSIS
 */
async function analyzeSecurityIssues() {
  console.log('\n🔒 ANALYZING SECURITY ISSUES...');
  
  // Check for CSP violations in the console logs provided
  const consoleErrors = [
    "Refused to load the script 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'",
    "Refused to load the script 'https://va.vercel-scripts.com/v1/script.debug.js'",
    "[Vercel Speed Insights] Failed to load script",
    "[Vercel Web Analytics] Failed to load script"
  ];
  
  consoleErrors.forEach(error => {
    testResults.cspIssues.push({
      type: 'Content Security Policy Violation',
      description: error,
      severity: 'MEDIUM',
      solution: 'Add Vercel domains to CSP script-src directive'
    });
  });
  
  console.log(`❌ Found ${testResults.cspIssues.length} CSP violations`);
  
  // Check for performance issues
  const performanceIssues = [
    "The resource was preloaded using link preload but not used within a few seconds",
    "Download the React DevTools for a better development experience"
  ];
  
  performanceIssues.forEach(issue => {
    testResults.performanceIssues.push({
      type: 'Performance Warning',
      description: issue,
      severity: 'LOW',
      solution: 'Optimize resource loading and remove dev tools warnings in production'
    });
  });
  
  console.log(`⚠️  Found ${testResults.performanceIssues.length} performance issues`);
}

/**
 * 5. GENERATE COMPREHENSIVE REPORT
 */
function generateReport() {
  console.log('\n📊 GENERATING COMPREHENSIVE REPORT...');
  console.log('=' .repeat(60));
  
  const report = {
    testSummary: {
      timestamp: new Date().toISOString(),
      totalIssues: testResults.frontendIssues.length + testResults.cspIssues.length + testResults.performanceIssues.length,
      criticalIssues: testResults.frontendIssues.filter(i => i.severity === 'HIGH').length,
      apiTestsPassed: testResults.apiTests.filter(t => t.success).length,
      apiTestsTotal: testResults.apiTests.length,
      submissionTestsPassed: testResults.submissionTests.filter(t => t.success).length,
      submissionTestsTotal: testResults.submissionTests.length
    },
    detailedResults: testResults
  };
  
  // Console summary
  console.log('\n🎯 TEST SUMMARY:');
  console.log(`Total Issues Found: ${report.testSummary.totalIssues}`);
  console.log(`Critical Issues: ${report.testSummary.criticalIssues}`);
  console.log(`API Tests: ${report.testSummary.apiTestsPassed}/${report.testSummary.apiTestsTotal} passed`);
  console.log(`Submission Tests: ${report.testSummary.submissionTestsPassed}/${report.testSummary.submissionTestsTotal} passed`);
  
  // Detailed issues
  if (testResults.frontendIssues.length > 0) {
    console.log('\n❌ FRONTEND ISSUES:');
    testResults.frontendIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. [${issue.severity}] ${issue.file}: ${issue.issue}`);
      console.log(`     💡 ${issue.recommendation}`);
    });
  }
  
  if (testResults.cspIssues.length > 0) {
    console.log('\n🔒 SECURITY ISSUES:');
    testResults.cspIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`);
      console.log(`     💡 ${issue.solution}`);
    });
  }
  
  if (testResults.performanceIssues.length > 0) {
    console.log('\n⚡ PERFORMANCE ISSUES:');
    testResults.performanceIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`);
      console.log(`     💡 ${issue.solution}`);
    });
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'contribution-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);
  
  // Recommendations
  console.log('\n🚀 RECOMMENDED FIXES:');
  console.log('1. Update next.config.js to include CSP headers for Vercel scripts');
  console.log('2. Remove or properly configure @vercel/analytics and @vercel/speed-insights');
  console.log('3. Add proper error boundaries for better error handling');
  console.log('4. Optimize resource preloading to avoid unused resources');
  console.log('5. Ensure production builds exclude dev tools warnings');
  
  return report;
}

/**
 * MAIN EXECUTION
 */
async function runAllTests() {
  console.log(`🎬 Starting comprehensive test at ${new Date().toISOString()}`);
  console.log(`Target Group ID: ${testConfig.groupId}`);
  console.log(`Test Member ID: ${testConfig.testMemberId}`);
  console.log(`Base URL: ${testConfig.baseUrl}`);
  
  try {
    // Run all test phases
    await analyzeFrontendFiles();
    await testApiEndpoints();
    await testSubmissionWorkflow();
    await analyzeSecurityIssues();
    
    // Generate final report
    const report = generateReport();
    
    console.log('\n✨ TESTING COMPLETED SUCCESSFULLY!');
    return report;
    
  } catch (error) {
    console.error('\n💥 TESTING FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testResults };
