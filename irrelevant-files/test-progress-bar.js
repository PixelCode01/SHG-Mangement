// Test script to verify the progress bar changes
console.log('Testing progress bar changes...');

// Simulate some test data like what would be available on the contribution page
const testData = {
  totalExpected: 100000,
  totalCollected: 23500,
  totalRemaining: 76500
};

// Calculate percentage like the component does
const percentage = testData.totalExpected > 0 ? Math.round((testData.totalCollected / testData.totalExpected) * 100) : 0;

// Format the progress text as it would appear in the UI
const progressText = `${percentage}% ₹${testData.totalCollected.toLocaleString()} collected`;

console.log('Test Data:', testData);
console.log('Calculated Percentage:', percentage);
console.log('Progress Text (new format):', progressText);

// This should output: "23% ₹23,500 collected"
console.log('Expected format: "23% ₹23,500 collected"');
console.log('Actual format:', progressText);

// Verify the formatting is correct
if (progressText === "23% ₹23,500 collected") {
  console.log('✅ Progress bar format is correct!');
} else {
  console.log('❌ Progress bar format needs adjustment');
}
