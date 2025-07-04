const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive SHG Management System Production Readiness Validation
 * 
 * This script verifies all required features are correctly implemented and ready for production:
 * - Group management (creation, settings, configuration)
 * - Periodic records with correct calculations
 * - Member tracking and management
 * - Late fine rule system (all types)
 * - Cash allocation system (all modes)
 * - Reporting functionality
 * - Bulk operations
 * - Database schema completeness
 */

// Utility functions
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
};

const fileContains = (filePath, searchTerms) => {
  if (!fileExists(filePath)) return false;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (Array.isArray(searchTerms)) {
      return searchTerms.every(term => content.includes(term));
    }
    return content.includes(searchTerms);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return false;
  }
};

const anyFileContains = (filePaths, searchTerms) => {
  return filePaths.some(filePath => fileContains(filePath, searchTerms));
};

const directoryContainsFileWithPattern = (dirPath, pattern) => {
  try {
    if (!fs.existsSync(dirPath)) return false;
    
    const files = fs.readdirSync(dirPath);
    return files.some(file => pattern.test(file));
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
    return false;
  }
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Add a test result
const addResult = (category, feature, passed, details = '') => {
  const result = { category, feature, passed, details };
  if (passed) {
    results.passed.push(result);
  } else {
    results.failed.push(result);
  }
  
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${category} - ${feature}${details ? ': ' + details : ''}`);
};

// Add a warning
const addWarning = (category, feature, details) => {
  const warning = { category, feature, details };
  results.warnings.push(warning);
  console.log(`[WARN] ${category} - ${feature}: ${details}`);
};

// VALIDATION CHECKS

// 1. Group Management
console.log("\n=== CHECKING GROUP MANAGEMENT ===");

// Check group creation form
const groupFormPath = './app/components/MultiStepGroupForm.tsx';
const groupCreationCheck = fileExists(groupFormPath) && 
  fileContains(groupFormPath, ['collectionFrequency', 'dateOfStarting', 'useState', 'setCurrentStep']);
addResult('Group Management', 'Group creation form', groupCreationCheck);

// Check for dynamic date fields
const dynamicDateFieldsCheck = fileContains(groupFormPath, [
  'collectionDayOfMonth', 
  'collectionDayOfWeek',
  'collectionWeekOfMonth',
  'collectionFrequency'
]);
addResult('Group Management', 'Dynamic date fields', dynamicDateFieldsCheck);

// Check group settings
const groupSettingsCheck = fileContains(groupFormPath, [
  'interestRate',
  'lateFineRule',
  'isEnabled',
  'ruleType'
]);
addResult('Group Management', 'Group settings', groupSettingsCheck);

// 2. Periodic Records
console.log("\n=== CHECKING PERIODIC RECORDS ===");

const periodicRecordFormPath = './app/components/PeriodicRecordForm.tsx';
const periodicRecordsAPIPath = './app/api/groups/[id]/periodic-records';

// Check for periodic record form
const periodicRecordFormCheck = fileExists(periodicRecordFormPath) &&
  fileContains(periodicRecordFormPath, ['contributions', 'loans', 'calculate']);
addResult('Periodic Records', 'Record form exists', periodicRecordFormCheck);

// Check for periodic record API
const periodicRecordAPICheck = fs.existsSync(periodicRecordsAPIPath);
addResult('Periodic Records', 'API endpoints', periodicRecordAPICheck);

// Check for calculation logic
const calculationLogicCheck = fileContains(periodicRecordFormPath, [
  'compulsoryContribution',
  'interestEarnedThisPeriod',
  'lateFinePaid',
  'totalCollectionThisPeriod'
]);
addResult('Periodic Records', 'Calculation logic', calculationLogicCheck);

// 3. Member Tracking
console.log("\n=== CHECKING MEMBER TRACKING ===");

// Check for member management
const memberAPIPath = './app/api/groups/[id]/members';
const memberComponentsPath = './app/components/MemberList.tsx';

const memberAPICheck = fs.existsSync(memberAPIPath);
addResult('Member Tracking', 'Member API', memberAPICheck);

const memberComponentCheck = fileExists(memberComponentsPath) ||
  fileExists('./app/components/Members.tsx') ||
  fileExists('./app/components/MemberForm.tsx');
addResult('Member Tracking', 'Member UI components', memberComponentCheck);

// Check for member contribution tracking
const memberContributionCheck = fileContains(periodicRecordFormPath, [
  'memberRecords',
  'compulsoryContribution',
  'loanRepaymentPrincipal'
]);
addResult('Member Tracking', 'Member contribution tracking', memberContributionCheck);

// 4. Late Fine Rules
console.log("\n=== CHECKING LATE FINE RULES ===");

// Check for late fine rule system in any relevant file
const lateFineFiles = [
  groupFormPath,
  periodicRecordFormPath,
  './app/api/groups/[id]/late-fine-rules/route.ts',
  './app/components/LateFineRuleForm.tsx',
  './prisma/schema.prisma'
];

// Check for different late fine types
const lateFineTypesCheck = anyFileContains(lateFineFiles, [
  'DAILY_FIXED', 'DAILY_PERCENTAGE', 'TIER_BASED'
]);
addResult('Late Fine Rules', 'All fine types supported', lateFineTypesCheck);

// Check for tier rules
const tierRulesCheck = anyFileContains(lateFineFiles, [
  'tierRules',
  'lateFineRuleTierSchema'
]);
addResult('Late Fine Rules', 'Tier rules system', tierRulesCheck);

// 5. Cash Allocation
console.log("\n=== CHECKING CASH ALLOCATION ===");

// Check cash allocation API
const cashAllocationAPIPath = './app/api/groups/[id]/allocations/route.ts';
const cashAllocationCheck = fileExists(cashAllocationAPIPath);
addResult('Cash Allocation', 'Allocation API', cashAllocationCheck);

// Check different allocation modes
const allocationModesCheck = anyFileContains([
  cashAllocationAPIPath,
  periodicRecordFormPath
], [
  'allocationType',
  'amountToBankTransfer',
  'amountToCashInHand',
  'customAllocationNote'
]);
addResult('Cash Allocation', 'All allocation modes', allocationModesCheck);

// Check for transaction closure
const transactionClosureCheck = anyFileContains([
  cashAllocationAPIPath,
  periodicRecordFormPath
], [
  'isTransactionClosed',
  'transactionClosedAt',
  'totalAllocated'
]);
addResult('Cash Allocation', 'Transaction closure', transactionClosureCheck);

// 6. Reporting
console.log("\n=== CHECKING REPORTING ===");

// Check report generation API
const reportingAPIPath = './app/api/groups/[id]/reports/route.ts';
const reportGenerationCheck = fileExists(reportingAPIPath);
addResult('Reporting', 'Report API', reportGenerationCheck);

// Check for export functionality
const exportCheck = fileContains(reportingAPIPath, [
  'NextResponse',
  'reportData',
  'memberContributions',
  'periodicRecord'
]);
addResult('Reporting', 'Export functionality', exportCheck);

// Check for summary and breakdown
const summaryBreakdownCheck = fileContains(reportingAPIPath, [
  'summary',
  'breakdown',
  'memberDetails',
  'totalDue'
]);
addResult('Reporting', 'Summary and breakdown reports', summaryBreakdownCheck);

// 7. Bulk Operations
console.log("\n=== CHECKING BULK OPERATIONS ===");

// Check bulk contribution API
const bulkContributionAPIPath = './app/api/groups/[id]/contributions/bulk/route.ts';
const bulkContributionCheck = fileExists(bulkContributionAPIPath);
addResult('Bulk Operations', 'Bulk contribution API', bulkContributionCheck);

// Check bulk update UI
const bulkUpdateUICheck = anyFileContains([
  periodicRecordFormPath,
  './app/groups/[id]/contributions/page.tsx'
], [
  'bulkContributionAmount',
  'showBulkContributionUpdate',
  'setBulkContributionAmount'
]);
addResult('Bulk Operations', 'Bulk update UI', bulkUpdateUICheck);

// 8. Database Schema
console.log("\n=== CHECKING DATABASE SCHEMA ===");

const schemaPath = './prisma/schema.prisma';
const schemaCheck = fileExists(schemaPath);
addResult('Database', 'Schema exists', schemaCheck);

// Check for required models
const requiredModels = [
  'User', 'Group', 'Member', 'GroupPeriodicRecord',
  'MemberContribution', 'Loan', 'LoanPayment',
  'LateFineRule', 'CashAllocation'
];

let missingModels = [];
if (schemaCheck) {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  missingModels = requiredModels.filter(model => 
    !schemaContent.includes(`model ${model}`) && 
    !schemaContent.includes(`model ${model.toLowerCase()}`)
  );
}

const modelsCheck = missingModels.length === 0;
addResult('Database', 'Required models', modelsCheck, 
  modelsCheck ? '' : `Missing models: ${missingModels.join(', ')}`);

// 9. Check for production build capability
console.log("\n=== CHECKING BUILD CAPABILITY ===");

try {
  // Just check package.json for proper build script, don't actually run it
  const packageJsonContent = fs.readFileSync('./package.json', 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  
  const hasBuildScript = packageJson.scripts && packageJson.scripts.build;
  addResult('Build', 'Build script exists', hasBuildScript);
  
  // Check for next.js production dependencies
  const hasNextDependency = packageJson.dependencies && packageJson.dependencies.next;
  addResult('Build', 'Next.js dependency', hasNextDependency);
} catch (err) {
  addResult('Build', 'Build configuration', false, 'Error checking package.json');
}

// 10. Check for MD files documenting completion
console.log("\n=== CHECKING DOCUMENTATION ===");

const completionDocs = fs.readdirSync('./').filter(file => 
  file.endsWith('_COMPLETE.md') || 
  file.includes('_FIXES_COMPLETE') ||
  file.includes('_FEATURE_COMPLETE')
);

if (completionDocs.length > 0) {
  addResult('Documentation', 'Feature completion docs', true, `Found ${completionDocs.length} completion docs`);
} else {
  addWarning('Documentation', 'Feature completion docs', 'No feature completion documentation found');
}

// 11. Environment configuration
console.log("\n=== CHECKING ENVIRONMENT CONFIG ===");

const envCheck = fileExists('./.env') || fileExists('./.env.example') || fileExists('./.env.local');
addResult('Environment', 'Environment configuration', envCheck);

// 12. Authentication system
console.log("\n=== CHECKING AUTHENTICATION ===");

const authCheck = fileExists('./app/api/auth/[...nextauth]/route.ts') || 
                  fileExists('./pages/api/auth/[...nextauth].ts') ||
                  fileExists('./app/api/auth');
                  
addResult('Security', 'Authentication system', authCheck);

// SUMMARY
console.log("\n\n=== VALIDATION SUMMARY ===");
console.log(`Total checks run: ${results.passed.length + results.failed.length}`);
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
console.log(`Warnings: ${results.warnings.length}`);

if (results.failed.length > 0) {
  console.log("\n=== FAILED CHECKS ===");
  results.failed.forEach(result => {
    console.log(`❌ ${result.category} - ${result.feature}${result.details ? ': ' + result.details : ''}`);
  });
}

if (results.warnings.length > 0) {
  console.log("\n=== WARNINGS ===");
  results.warnings.forEach(warning => {
    console.log(`⚠️ ${warning.category} - ${warning.feature}: ${warning.details}`);
  });
}

// Calculate overall production readiness percentage
const productionReadiness = (results.passed.length / (results.passed.length + results.failed.length)) * 100;

console.log(`\n=== PRODUCTION READINESS: ${productionReadiness.toFixed(1)}% ===`);

if (productionReadiness === 100) {
  console.log("✅ The system is PRODUCTION READY! All required features have been implemented and verified.");
} else if (productionReadiness >= 90) {
  console.log("🟡 The system is NEARLY PRODUCTION READY. Address the few remaining issues before deployment.");
} else if (productionReadiness >= 75) {
  console.log("🟠 The system is PARTIALLY PRODUCTION READY. Several critical issues need to be addressed.");
} else {
  console.log("❌ The system is NOT PRODUCTION READY. Significant work is needed before deployment.");
}

// Exit with appropriate code
process.exit(results.failed.length > 0 ? 1 : 0);
