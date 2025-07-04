// Debug script to check late fine config rendering in MultiStepGroupForm
// This script will add console logging to identify where the issue might be

const fs = require('fs');
const path = require('path');

const formPath = path.join(process.cwd(), 'app/components/MultiStepGroupForm.tsx');

// Read the current file
const fileContent = fs.readFileSync(formPath, 'utf8');

// Check if debug logging is already added
if (!fileContent.includes('DEBUG: lateFineEnabled value')) {
  console.log('Adding debug logging to MultiStepGroupForm...');
  
  // Add debug logging after the lateFineEnabled declaration
  const searchText = 'const lateFineEnabled = useWatch({ control, name: \'lateFineRule.isEnabled\' });';
  const replaceText = `const lateFineEnabled = useWatch({ control, name: 'lateFineRule.isEnabled' });
  
  // DEBUG: Log the lateFineEnabled value
  console.log('DEBUG: lateFineEnabled value:', lateFineEnabled);`;
  
  const updatedContent = fileContent.replace(searchText, replaceText);
  
  if (updatedContent !== fileContent) {
    fs.writeFileSync(formPath, updatedContent);
    console.log('Debug logging added to MultiStepGroupForm.tsx');
    console.log('Now check the browser console when toggling the late fine checkbox.');
  } else {
    console.log('Could not find the exact text to replace. The file might have been modified.');
  }
} else {
  console.log('Debug logging already present in MultiStepGroupForm.tsx');
}

// Also check the conditional rendering part
const conditionalText = '{lateFineEnabled && (';
if (fileContent.includes(conditionalText)) {
  console.log('✓ Conditional rendering code found in MultiStepGroupForm.tsx');
} else {
  console.log('✗ Conditional rendering code NOT found in MultiStepGroupForm.tsx');
}

// Check if the field is registered correctly
const registerText = 'register("lateFineRule.isEnabled")';
if (fileContent.includes(registerText)) {
  console.log('✓ Field registration found in MultiStepGroupForm.tsx');
} else {
  console.log('✗ Field registration NOT found in MultiStepGroupForm.tsx');
}

console.log('\nTo test:');
console.log('1. Open http://localhost:3000/groups/create in your browser');
console.log('2. Open browser developer tools (F12)');
console.log('3. Go to Console tab');
console.log('4. Click the "Enable Late Fine System" checkbox');
console.log('5. Check if debug messages appear and if the config section shows');
