#!/usr/bin/env node

/**
 * Test script for period closing and record editing API endpoints
 */

async function testPeriodClosingAndEditing() {
  console.log('=== TESTING PERIOD CLOSING AND RECORD EDITING API ENDPOINTS ===\n');
  
  const groupId = '68466fdfad5c6b70fdd420d7'; // jn group
  const baseUrl = 'http://localhost:3000/api';
  
  try {
    // Step 1: Get current group info
    console.log('1. FETCHING GROUP INFO');
    const groupResponse = await fetch(`${baseUrl}/groups/${groupId}`);
    
    if (!groupResponse.ok) {
      console.log(`❌ Failed to fetch group: ${groupResponse.status} ${groupResponse.statusText}`);
      const errorText = await groupResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }
    
    const group = await groupResponse.json();
    console.log(`Group: ${group.name} (ID: ${group.id || group._id})`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Balance in Bank: ₹${group.balanceInBank}`);
    
    // Step 2: Get current period (if any)
    console.log('\n2. CHECKING CURRENT PERIOD');
    const currentPeriodResponse = await fetch(`${baseUrl}/groups/${groupId}/contributions/periods/current`);
    
    if (!currentPeriodResponse.ok) {
      console.log(`❌ Failed to fetch current period: ${currentPeriodResponse.status} ${currentPeriodResponse.statusText}`);
      const errorText = await currentPeriodResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }
    
    const currentPeriod = await currentPeriodResponse.json();
    console.log(`Current period: ${JSON.stringify(currentPeriod, null, 2)}`);
    
    // Step 3: Get all periods
    console.log('\n3. FETCHING ALL PERIODS');
    const periodsResponse = await fetch(`${baseUrl}/groups/${groupId}/contributions/periods`);
    
    if (!periodsResponse.ok) {
      console.log(`❌ Failed to fetch periods: ${periodsResponse.status} ${periodsResponse.statusText}`);
      const errorText = await periodsResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }
    
    const periods = await periodsResponse.json();
    console.log(`Found ${periods.length} periods`);
    
    if (periods.length > 0) {
      console.log(`Latest period: ${JSON.stringify(periods[0], null, 2)}`);
    }
    
    // Step 4: Get current contributions
    console.log('\n4. FETCHING CURRENT CONTRIBUTIONS');
    const contributionsResponse = await fetch(`${baseUrl}/groups/${groupId}/contributions/current`);
    
    if (!contributionsResponse.ok) {
      console.log(`❌ Failed to fetch contributions: ${contributionsResponse.status} ${contributionsResponse.statusText}`);
      const errorText = await contributionsResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }
    
    const contributions = await contributionsResponse.json();
    console.log(`Found ${contributions.length} contributions`);
    
    // Step 5: Get periodic records
    console.log('\n5. FETCHING PERIODIC RECORDS');
    const recordsResponse = await fetch(`${baseUrl}/groups/${groupId}/periodic-records`);
    
    if (!recordsResponse.ok) {
      console.log(`❌ Failed to fetch periodic records: ${recordsResponse.status} ${recordsResponse.statusText}`);
      const errorText = await recordsResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }
    
    const records = await recordsResponse.json();
    console.log(`Found ${records.length} periodic records`);
    
    if (records.length > 0) {
      console.log(`Latest record: ${JSON.stringify(records[0], null, 2)}`);
      
      // Step 6: Try to edit the latest record
      const latestRecordId = records[0].id || records[0]._id;
      console.log(`\n6. TESTING RECORD EDITING FOR RECORD ${latestRecordId}`);
      
      // Make a small modification to the record
      const modifiedRecord = { ...records[0] };
      if (modifiedRecord.totalCollectionThisPeriod !== undefined) {
        modifiedRecord.totalCollectionThisPeriod += 100;
      }
      
      const editResponse = await fetch(`${baseUrl}/groups/${groupId}/periodic-records/${latestRecordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modifiedRecord)
      });
      
      if (!editResponse.ok) {
        console.log(`❌ Failed to edit record: ${editResponse.status} ${editResponse.statusText}`);
        const errorText = await editResponse.text();
        console.log(`Error: ${errorText}`);
      } else {
        const editedRecord = await editResponse.json();
        console.log('✅ Record edited successfully');
        console.log(`Updated record: ${JSON.stringify(editedRecord, null, 2)}`);
        
        // Revert the change
        console.log('\nReverting the change...');
        const revertResponse = await fetch(`${baseUrl}/groups/${groupId}/periodic-records/${latestRecordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(records[0]) // Original record
        });
        
        if (!revertResponse.ok) {
          console.log(`❌ Failed to revert change: ${revertResponse.status} ${revertResponse.statusText}`);
        } else {
          console.log('✅ Change reverted successfully');
        }
      }
    }
    
    // Step 7: Test period closing API (if a current period exists)
    if (currentPeriod && Object.keys(currentPeriod).length > 0) {
      console.log('\n7. TESTING PERIOD CLOSING');
      
      const closeResponse = await fetch(`${baseUrl}/groups/${groupId}/contributions/periods/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!closeResponse.ok) {
        console.log(`❌ Failed to close period: ${closeResponse.status} ${closeResponse.statusText}`);
        const errorText = await closeResponse.text();
        console.log(`Error: ${errorText}`);
      } else {
        const closedPeriod = await closeResponse.json();
        console.log('✅ Period closed successfully');
        console.log(`Closed period: ${JSON.stringify(closedPeriod, null, 2)}`);
        
        // Check for new periodic record after closing
        console.log('\nChecking for new periodic record after closing...');
        const newRecordsResponse = await fetch(`${baseUrl}/groups/${groupId}/periodic-records`);
        
        if (newRecordsResponse.ok) {
          const newRecords = await newRecordsResponse.json();
          console.log(`Found ${newRecords.length} periodic records after closing`);
          
          if (newRecords.length > records.length) {
            console.log('✅ New periodic record was created');
            console.log(`New record: ${JSON.stringify(newRecords[0], null, 2)}`);
          } else {
            console.log('❌ No new periodic record was created');
          }
        }
        
        // Step 8: Test period reopening
        console.log('\n8. TESTING PERIOD REOPENING');
        
        const reopenResponse = await fetch(`${baseUrl}/groups/${groupId}/contributions/periods/reopen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ periodId: closedPeriod.id || closedPeriod._id })
        });
        
        if (!reopenResponse.ok) {
          console.log(`❌ Failed to reopen period: ${reopenResponse.status} ${reopenResponse.statusText}`);
          const errorText = await reopenResponse.text();
          console.log(`Error: ${errorText}`);
        } else {
          const reopenedPeriod = await reopenResponse.json();
          console.log('✅ Period reopened successfully');
          console.log(`Reopened period: ${JSON.stringify(reopenedPeriod, null, 2)}`);
        }
      }
    } else {
      console.log('\n7. SKIPPING PERIOD CLOSING (no current period found)');
    }
    
    console.log('\n=== API ENDPOINT TESTING COMPLETE ===');
    
  } catch (error) {
    console.error('Error during API testing:', error);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const isServerRunning = await checkServer();
  
  if (!isServerRunning) {
    console.log('❌ Development server is not running on port 3000');
    console.log('Please start the server with: npm run dev');
    return;
  }
  
  await testPeriodClosingAndEditing();
}

main().catch(console.error);
