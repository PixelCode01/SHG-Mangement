// Test file to verify same-name member linking functionality
console.log('Testing same-name member linking...');

// Test data
const currentUserName = "John Doe";
const createdMembers = [
  { id: "member1", name: "John Doe" },
  { id: "member2", name: "Jane Smith" },
  { id: "member3", name: "john doe" }, // Case variation
];

// Same-name detection logic
const sameNameMembersList = [];

if (currentUserName) {
  createdMembers.forEach(member => {
    if (member.name.trim().toLowerCase() === currentUserName.trim().toLowerCase()) {
      sameNameMembersList.push({
        id: member.id,
        name: member.name,
        canLink: true
      });
    }
  });
}

console.log('Current user name:', currentUserName);
console.log('Created members:', createdMembers);
console.log('Same-name members found:', sameNameMembersList);

if (sameNameMembersList.length > 0) {
  console.log('✅ Same-name detection is working correctly!');
  console.log(`Found ${sameNameMembersList.length} members with same name as user.`);
} else {
  console.log('❌ No same-name members found');
}

// Test the confirmation logic
function testConfirmationDialog(memberId, memberName) {
  console.log(`\n🔍 Testing confirmation for member: ${memberName} (${memberId})`);
  console.log('Would show confirmation dialog:');
  console.log(`"Do you want to link "${memberName}" to your leader account AND select them as the group leader?"`);
  console.log('• Clear the current leader selection');
  console.log(`• Link "${memberName}" to your account`);
  console.log(`• Auto-select "${memberName}" as the group leader`);
  console.log('Click OK to proceed or Cancel to just link without changing leader selection.');
}

// Test for each same-name member
sameNameMembersList.forEach(member => {
  testConfirmationDialog(member.id, member.name);
});

console.log('\n✅ Same-name member linking test completed!');
