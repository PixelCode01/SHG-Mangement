// Debug script to test API endpoints
const groupId = '68450d0aba4742c4ab83f661';

console.log('Testing API endpoints...');
console.log('Group ID:', groupId);
console.log('Expected URLs:');
console.log(`- GET: http://localhost:3000/api/groups/${groupId}/contributions/current`);
console.log(`- POST: http://localhost:3000/api/groups/${groupId}/contributions/current`);
console.log(`- GET: http://localhost:3000/api/groups/${groupId}/contributions/periods/current`);

// Check if the URL format is correct
const testUrl = `/api/groups/${groupId}/contributions/current`;
console.log('\nURL Analysis:');
console.log('Test URL:', testUrl);
console.log('URL Length:', testUrl.length);
console.log('Contains special chars:', /[^a-zA-Z0-9\/\-_]/.test(testUrl));

// Test the group ID format
console.log('\nGroup ID Analysis:');
console.log('Is valid ObjectId format:', /^[a-f\d]{24}$/i.test(groupId));
console.log('Group ID length:', groupId.length);
