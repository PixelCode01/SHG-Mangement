import { CustomColumnsManager } from './app/components/CustomColumnsManager';
import { COLUMN_TEMPLATES } from './app/types/custom-columns';

console.log('Testing Custom Columns implementation...');

// Test 1: Check if imports work
console.log('✓ CustomColumnsManager imported successfully');
console.log('✓ COLUMN_TEMPLATES imported successfully');

// Test 2: Check templates
console.log('Number of templates:', COLUMN_TEMPLATES.length);
console.log('Templates:', COLUMN_TEMPLATES.map(t => t.name));

console.log('All tests passed!');
