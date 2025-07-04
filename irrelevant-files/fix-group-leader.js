// Quick fix script to update group leader ID
// This will update the group leader to match the current user's ID

const groupId = '6746fc3b52e4b5825b8e3e0a'; // Replace with actual group ID if different
const currentUserId = '6841a55c4aee2245b9ff2f8b'; // Your current user ID
const leaderUserId = '6841a59d4aee2245b9ff2f92'; // Current leader ID in database

console.log('=== GROUP LEADER FIX SCRIPT ===');
console.log('Group ID:', groupId);
console.log('Current User ID (you):', currentUserId);
console.log('Current Leader ID in DB:', leaderUserId);
console.log('====================================');

// Function to update group leader
async function updateGroupLeader() {
  try {
    // First, let's check if we can find the correct group ID
    const groupsResponse = await fetch('/api/groups');
    const groups = await groupsResponse.json();
    
    console.log('Available groups:', groups);
    
    // Find the group where ASHOK KUMAR KESHRI is the leader
    const targetGroup = groups.find(group => 
      group.leader?.name === 'ASHOK KUMAR KESHRI' || 
      group.leader?.id === leaderUserId
    );
    
    if (!targetGroup) {
      console.error('Could not find the target group');
      return;
    }
    
    console.log('Found target group:', targetGroup);
    
    // Update the group leader ID
    const updateResponse = await fetch(`/api/groups/${targetGroup.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leaderId: currentUserId // Update to your current user ID
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Failed to update group leader:', updateResponse.status, errorText);
      return;
    }
    
    const updatedGroup = await updateResponse.json();
    console.log('Successfully updated group leader:', updatedGroup);
    
    // Refresh the page to see changes
    window.location.reload();
    
  } catch (error) {
    console.error('Error updating group leader:', error);
  }
}

// Call the function
updateGroupLeader();
