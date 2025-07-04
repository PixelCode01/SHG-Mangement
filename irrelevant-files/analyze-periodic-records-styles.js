const fs = require('fs');
const path = require('path');

// Read the current periodic records page
const periodicRecordsPath = path.join(__dirname, 'app/groups/[id]/periodic-records/page.tsx');
const content = fs.readFileSync(periodicRecordsPath, 'utf8');

console.log('=== Periodic Records Page Style Analysis ===');

// Check for text color classes
const textColorMatches = content.match(/text-\w+-\d+/g) || [];
const bgColorMatches = content.match(/bg-\w+-\d+/g) || [];
const borderColorMatches = content.match(/border-\w+-\d+/g) || [];

console.log('\n📝 Text Colors Found:');
[...new Set(textColorMatches)].forEach(color => console.log(`  - ${color}`));

console.log('\n🎨 Background Colors Found:');
[...new Set(bgColorMatches)].forEach(color => console.log(`  - ${color}`));

console.log('\n🔲 Border Colors Found:');
[...new Set(borderColorMatches)].forEach(color => console.log(`  - ${color}`));

// Check for dark mode classes
const darkModeClasses = content.match(/dark:[^\s]+/g) || [];
console.log('\n🌙 Dark Mode Classes Found:');
[...new Set(darkModeClasses)].forEach(cls => console.log(`  - ${cls}`));

// Verify contrast improvements
const contrastChecks = [
  'text-blue-900 dark:text-blue-100',
  'text-green-900 dark:text-green-100', 
  'text-purple-900 dark:text-purple-100',
  'text-orange-900 dark:text-orange-100',
  'bg-blue-900/30',
  'bg-green-900/30',
  'bg-purple-900/30',
  'bg-orange-900/30'
];

console.log('\n✅ Contrast Improvements Applied:');
contrastChecks.forEach(check => {
  if (content.includes(check)) {
    console.log(`  ✅ ${check}`);
  } else {
    console.log(`  ❌ Missing: ${check}`);
  }
});

console.log('\n🎯 Summary Card Structure Check:');
const cardSections = [
  'Meeting Details',
  'Cash Position', 
  'Period Income',
  'Period Summary'
];

cardSections.forEach(section => {
  if (content.includes(section)) {
    console.log(`  ✅ ${section} section found`);
  } else {
    console.log(`  ❌ ${section} section missing`);
  }
});

console.log('\n📊 Style Recommendations:');
console.log('- Use text-color-900 for headers in light mode, text-color-100 in dark mode for maximum contrast');
console.log('- Use text-color-800 for content in light mode, text-color-200 in dark mode');
console.log('- Use background opacity /30 for better visibility in dark mode');
console.log('- Use border-color-600 in dark mode for better definition');
console.log('- Add shadow-sm or shadow-md for better card separation');
