/**
 * Test script to verify Custom Columns integration
 */
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Custom Columns Integration...\n');

// Test 1: Check if all required files exist
const requiredFiles = [
  'app/types/custom-columns.ts',
  'app/components/CustomColumnsManager.tsx',
  'app/components/ColumnEditor.tsx',
  'app/components/FormulaBuilder.tsx',
  'app/components/PropertyEditor.tsx',
  'app/components/TemplateSelector.tsx',
  'app/components/SchemaPreview.tsx',
  'app/components/BulkEditor.tsx',
  'app/groups/[id]/edit/page.tsx',
  'app/api/groups/[id]/custom-schema/route.ts'
];

let allFilesExist = true;
console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Test 2: Check for TypeScript compilation errors
console.log('\n🔧 Checking TypeScript compilation...');
try {
  const { execSync } = require('child_process');
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('  ✅ TypeScript compilation successful');
} catch (error) {
  console.log('  ❌ TypeScript compilation failed:');
  console.log(error.stdout?.toString() || error.message);
}

// Test 3: Check if imports are correct
console.log('\n📦 Checking imports in edit page...');
const editPagePath = path.join(__dirname, 'app/groups/[id]/edit/page.tsx');
if (fs.existsSync(editPagePath)) {
  const editPageContent = fs.readFileSync(editPagePath, 'utf8');
  const hasCustomColumnsImport = editPageContent.includes('import { CustomColumnsManager }');
  const hasSchemaImport = editPageContent.includes('import { GroupCustomSchema }');
  const hasModalRender = editPageContent.includes('CustomColumnsManager');
  const hasAdvancedButton = editPageContent.includes('Advanced Options');
  
  console.log(`  ${hasCustomColumnsImport ? '✅' : '❌'} CustomColumnsManager import`);
  console.log(`  ${hasSchemaImport ? '✅' : '❌'} GroupCustomSchema import`);
  console.log(`  ${hasModalRender ? '✅' : '❌'} CustomColumnsManager component rendering`);
  console.log(`  ${hasAdvancedButton ? '✅' : '❌'} Advanced Options button`);
}

// Test 4: Check API route
console.log('\n🌐 Checking API route...');
const apiRoutePath = path.join(__dirname, 'app/api/groups/[id]/custom-schema/route.ts');
if (fs.existsSync(apiRoutePath)) {
  const apiContent = fs.readFileSync(apiRoutePath, 'utf8');
  const hasGetMethod = apiContent.includes('export async function GET');
  const hasPostMethod = apiContent.includes('export async function POST');
  const hasAuth = apiContent.includes('getServerSession');
  
  console.log(`  ${hasGetMethod ? '✅' : '❌'} GET method implemented`);
  console.log(`  ${hasPostMethod ? '✅' : '❌'} POST method implemented`);
  console.log(`  ${hasAuth ? '✅' : '❌'} Authentication check`);
}

// Test 5: Check component dependencies
console.log('\n🧩 Checking component dependencies...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    '@heroicons/react',
    '@hello-pangea/dnd',
    'react-hook-form',
    'zod',
    '@hookform/resolvers'
  ];
  
  requiredDeps.forEach(dep => {
    const hasDepency = dependencies[dep];
    console.log(`  ${hasDepency ? '✅' : '❌'} ${dep}`);
  });
}

console.log('\n🎉 Integration test completed!');
console.log(allFilesExist ? '✅ All required files exist' : '❌ Some files are missing');
