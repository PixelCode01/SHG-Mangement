/**
 * Test script to verify complete leadership transfer functionality:
 * 1. Old leader gets demoted from GROUP_LEADER to MEMBER
 * 2. New leader gets promoted to GROUP_LEADER
 * 3. Group's leaderId is updated
 * 4. Old leader no longer sees the group in their interface
 * 5. Session updates work properly for both users
 */

const API_BASE = 'http://localhost:3001';

// Test credentials
const oldLeaderCreds = {
    email: 'test-leader@example.com',
    password: 'password123'
};

const newLeaderCreds = {
    email: 'test-member@example.com', 
    password: 'password123'
};

/**
 * Utility functions
 */
async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    const data = await response.json().catch(() => null);
    return { response, data };
}

async function loginUser(credentials) {
    const { response, data } = await makeRequest(`${API_BASE}/api/auth/signin/credentials`, {
        method: 'POST',
        body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
        throw new Error(`Login failed: ${data?.error || response.statusText}`);
    }
    
    // Extract session cookie
    const cookies = response.headers.get('set-cookie');
    const sessionCookie = cookies?.split(';')[0];
    
    return { sessionCookie, userData: data };
}

async function getUserGroups(sessionCookie) {
    const { response, data } = await makeRequest(`${API_BASE}/api/groups`, {
        headers: {
            'Cookie': sessionCookie
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to get groups: ${data?.error || response.statusText}`);
    }
    
    return data;
}

async function getUserProfile(sessionCookie) {
    const { response, data } = await makeRequest(`${API_BASE}/api/auth/session`, {
        headers: {
            'Cookie': sessionCookie
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to get session: ${data?.error || response.statusText}`);
    }
    
    return data;
}

async function acceptInvitation(invitationId, sessionCookie) {
    const { response, data } = await makeRequest(`${API_BASE}/api/pending-leaderships/${invitationId}`, {
        method: 'PATCH',
        headers: {
            'Cookie': sessionCookie
        },
        body: JSON.stringify({ status: 'ACCEPTED' })
    });
    
    return { response, data };
}

async function createLeadershipInvitation(groupId, memberId, sessionCookie) {
    const { response, data } = await makeRequest(`${API_BASE}/api/pending-leaderships`, {
        method: 'POST',
        headers: {
            'Cookie': sessionCookie
        },
        body: JSON.stringify({
            groupId,
            memberId
        })
    });
    
    return { response, data };
}

/**
 * Main test function
 */
async function testCompleteLeadershipTransfer() {
    console.log('🧪 Starting complete leadership transfer test...\n');
    
    try {
        // Step 1: Login as old leader
        console.log('1. Logging in as old leader...');
        const oldLeaderSession = await loginUser(oldLeaderCreds);
        console.log('✅ Old leader logged in successfully');
        
        // Step 2: Get old leader's profile and groups
        console.log('\n2. Getting old leader\'s initial state...');
        const oldLeaderInitialProfile = await getUserProfile(oldLeaderSession.sessionCookie);
        const oldLeaderInitialGroups = await getUserGroups(oldLeaderSession.sessionCookie);
        
        console.log(`Old leader role: ${oldLeaderInitialProfile.user.role}`);
        console.log(`Old leader ID: ${oldLeaderInitialProfile.user.memberId}`);
        console.log(`Old leader manages ${oldLeaderInitialGroups.length} groups`);
        
        if (oldLeaderInitialGroups.length === 0) {
            console.log('❌ Old leader has no groups. Please create a group first.');
            return;
        }
        
        const testGroup = oldLeaderInitialGroups[0];
        console.log(`Using test group: ${testGroup.name} (ID: ${testGroup.id})`);
        
        // Step 3: Login as new leader (member)
        console.log('\n3. Logging in as new leader (currently member)...');
        const newLeaderSession = await loginUser(newLeaderCreds);
        console.log('✅ New leader logged in successfully');
        
        // Step 4: Get new leader's initial profile
        console.log('\n4. Getting new leader\'s initial state...');
        const newLeaderInitialProfile = await getUserProfile(newLeaderSession.sessionCookie);
        const newLeaderInitialGroups = await getUserGroups(newLeaderSession.sessionCookie);
        
        console.log(`New leader role: ${newLeaderInitialProfile.user.role}`);
        console.log(`New leader ID: ${newLeaderInitialProfile.user.memberId}`);
        console.log(`New leader sees ${newLeaderInitialGroups.length} groups`);
        
        // Step 5: Create leadership invitation (as old leader)
        console.log('\n5. Creating leadership invitation...');
        const { response: inviteResponse, data: inviteData } = await createLeadershipInvitation(
            testGroup.id,
            newLeaderInitialProfile.user.memberId,
            oldLeaderSession.sessionCookie
        );
        
        if (!inviteResponse.ok) {
            console.log(`❌ Failed to create invitation: ${inviteData?.error || 'Unknown error'}`);
            return;
        }
        
        console.log(`✅ Leadership invitation created: ${inviteData.id}`);
        
        // Step 6: Accept invitation (as new leader)
        console.log('\n6. Accepting leadership invitation...');
        const { response: acceptResponse, data: acceptData } = await acceptInvitation(
            inviteData.id,
            newLeaderSession.sessionCookie
        );
        
        if (!acceptResponse.ok) {
            console.log(`❌ Failed to accept invitation: ${acceptData?.error || 'Unknown error'}`);
            return;
        }
        
        console.log('✅ Leadership invitation accepted');
        
        // Step 7: Wait a moment for database updates
        console.log('\n7. Waiting for database updates...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 8: Check old leader's new state
        console.log('\n8. Checking old leader\'s updated state...');
        const oldLeaderFinalProfile = await getUserProfile(oldLeaderSession.sessionCookie);
        const oldLeaderFinalGroups = await getUserGroups(oldLeaderSession.sessionCookie);
        
        console.log(`Old leader new role: ${oldLeaderFinalProfile.user.role}`);
        console.log(`Old leader now manages ${oldLeaderFinalGroups.length} groups`);
        
        // Step 9: Check new leader's new state  
        console.log('\n9. Checking new leader\'s updated state...');
        const newLeaderFinalProfile = await getUserProfile(newLeaderSession.sessionCookie);
        const newLeaderFinalGroups = await getUserGroups(newLeaderSession.sessionCookie);
        
        console.log(`New leader new role: ${newLeaderFinalProfile.user.role}`);
        console.log(`New leader now manages ${newLeaderFinalGroups.length} groups`);
        
        // Step 10: Validate results
        console.log('\n10. Validating leadership transfer...');
        
        let allTestsPassed = true;
        
        // Test 1: Old leader should be demoted to MEMBER
        if (oldLeaderFinalProfile.user.role !== 'MEMBER') {
            console.log(`❌ Old leader role not updated. Expected: MEMBER, Got: ${oldLeaderFinalProfile.user.role}`);
            allTestsPassed = false;
        } else {
            console.log('✅ Old leader successfully demoted to MEMBER');
        }
        
        // Test 2: New leader should be promoted to GROUP_LEADER  
        if (newLeaderFinalProfile.user.role !== 'GROUP_LEADER') {
            console.log(`❌ New leader role not updated. Expected: GROUP_LEADER, Got: ${newLeaderFinalProfile.user.role}`);
            allTestsPassed = false;
        } else {
            console.log('✅ New leader successfully promoted to GROUP_LEADER');
        }
        
        // Test 3: Old leader should not see the group anymore
        const oldLeaderStillSeesGroup = oldLeaderFinalGroups.some(g => g.id === testGroup.id);
        if (oldLeaderStillSeesGroup) {
            console.log('❌ Old leader still sees the group they no longer lead');
            allTestsPassed = false;
        } else {
            console.log('✅ Old leader no longer sees the group they used to lead');
        }
        
        // Test 4: New leader should now see the group
        const newLeaderSeesGroup = newLeaderFinalGroups.some(g => g.id === testGroup.id);
        if (!newLeaderSeesGroup) {
            console.log('❌ New leader does not see the group they now lead');
            allTestsPassed = false;
        } else {
            console.log('✅ New leader now sees the group they lead');
        }
        
        // Test 5: Group leader count should remain the same or decrease by 1
        const groupCountDifference = oldLeaderInitialGroups.length - oldLeaderFinalGroups.length;
        if (groupCountDifference !== 1) {
            console.log(`❌ Unexpected group count change for old leader. Expected: -1, Got: ${groupCountDifference}`);
            allTestsPassed = false;
        } else {
            console.log('✅ Old leader\'s group count decreased by 1');
        }
        
        console.log('\n' + '='.repeat(50));
        if (allTestsPassed) {
            console.log('🎉 ALL TESTS PASSED! Leadership transfer is working correctly.');
        } else {
            console.log('❌ SOME TESTS FAILED. Please check the implementation.');
        }
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testCompleteLeadershipTransfer();
