#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shg_management';

async function testCompletePeriodClosingWorkflow() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('=== TESTING COMPLETE PERIOD CLOSING WORKFLOW ===\n');
    
    const db = client.db();
    const groupId = '68466fdfad5c6b70fdd420d7'; // jn group
    const groupObjectId = new ObjectId(groupId);
    
    // Step 1: Check initial state
    console.log('1. CHECKING INITIAL STATE');
    const group = await db.collection('groups').findOne({ _id: groupObjectId });
    console.log(`Group: ${group.name} (Balance: ₹${group.currentBalance}, Cash: ₹${group.cashBalance})`);
    
    const openPeriod = await db.collection('periods').findOne({ 
      groupId: groupObjectId, 
      status: 'open' 
    });
    
    if (!openPeriod) {
      console.log('❌ No open period found!');
      return;
    }
    
    console.log(`Open Period: #${openPeriod.periodNumber} (ID: ${openPeriod._id})`);
    
    // Check contributions
    const contributions = await db.collection('contributions').find({ 
      periodId: openPeriod._id 
    }).toArray();
    console.log(`Contributions: ${contributions.length} records`);
    
    const paidCount = contributions.filter(c => c.status === 'paid').length;
    const pendingCount = contributions.filter(c => c.status === 'pending').length;
    console.log(`Status: ${paidCount} paid, ${pendingCount} pending\n`);
    
    // Step 2: Simulate period closing via API
    console.log('2. TESTING PERIOD CLOSING VIA API');
    
    try {
      const response = await fetch(`http://localhost:3003/api/groups/${groupId}/contributions/periods/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.log(`❌ API Error: ${response.status} - ${error}`);
        return;
      }
      
      const result = await response.json();
      console.log('✅ Period closed successfully via API');
      console.log(`Result:`, result);
      
    } catch (error) {
      console.log(`❌ API call failed: ${error.message}`);
      return;
    }
    
    // Step 3: Verify period is now closed
    console.log('\n3. VERIFYING PERIOD CLOSURE');
    
    const closedPeriod = await db.collection('periods').findOne({ _id: openPeriod._id });
    console.log(`Period status: ${closedPeriod.status}`);
    console.log(`Collection amount: ₹${closedPeriod.collectionAmount || 'Not set'}`);
    console.log(`Closed at: ${closedPeriod.closedAt || 'Not set'}`);
    
    // Check if periodic record was created
    const periodicRecord = await db.collection('periodicrecords').findOne({ 
      groupId: groupObjectId,
      periodId: closedPeriod._id 
    });
    
    if (periodicRecord) {
      console.log('✅ Periodic record created');
      console.log(`Record ID: ${periodicRecord._id}`);
      console.log(`Total Collection: ₹${periodicRecord.totalCollection}`);
      console.log(`Cash Allocated: ₹${periodicRecord.cashAllocated}`);
      console.log(`Group Standing: ${periodicRecord.groupStanding}`);
      console.log(`Member Records: ${periodicRecord.memberRecords?.length || 0}`);
    } else {
      console.log('❌ No periodic record found!');
    }
    
    // Step 4: Check group balance updates
    console.log('\n4. CHECKING GROUP BALANCE UPDATES');
    const updatedGroup = await db.collection('groups').findOne({ _id: groupObjectId });
    console.log(`Updated Balance: ₹${updatedGroup.currentBalance} (was ₹${group.currentBalance})`);
    console.log(`Updated Cash: ₹${updatedGroup.cashBalance} (was ₹${group.cashBalance})`);
    
    // Step 5: Test record editing
    console.log('\n5. TESTING RECORD EDITING');
    
    if (periodicRecord) {
      // Try to edit a member record (change contribution amount)
      const memberRecord = periodicRecord.memberRecords[0];
      const originalContribution = memberRecord.contribution;
      const newContribution = originalContribution + 100; // Add ₹100
      
      console.log(`Editing member ${memberRecord.memberName}'s contribution from ₹${originalContribution} to ₹${newContribution}`);
      
      try {
        const editResponse = await fetch(`http://localhost:3003/api/groups/${groupId}/periodic-records/${periodicRecord._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            memberRecords: periodicRecord.memberRecords.map(record => 
              record.memberId.toString() === memberRecord.memberId.toString()
                ? { ...record, contribution: newContribution }
                : record
            )
          })
        });
        
        if (editResponse.ok) {
          const editResult = await editResponse.json();
          console.log('✅ Record edited successfully');
          console.log(`New total collection: ₹${editResult.totalCollection}`);
        } else {
          const editError = await editResponse.text();
          console.log(`❌ Edit failed: ${editResponse.status} - ${editError}`);
        }
        
      } catch (error) {
        console.log(`❌ Edit request failed: ${error.message}`);
      }
    }
    
    // Step 6: Test period reopening (if needed for further testing)
    console.log('\n6. TESTING PERIOD REOPENING');
    
    try {
      const reopenResponse = await fetch(`http://localhost:3003/api/groups/${groupId}/contributions/periods/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ periodId: closedPeriod._id.toString() })
      });
      
      if (reopenResponse.ok) {
        const reopenResult = await reopenResponse.json();
        console.log('✅ Period reopened successfully');
        console.log(reopenResult);
      } else {
        const reopenError = await reopenResponse.text();
        console.log(`❌ Reopen failed: ${reopenResponse.status} - ${reopenError}`);
      }
      
    } catch (error) {
      console.log(`❌ Reopen request failed: ${error.message}`);
    }
    
    // Step 7: Check final state
    console.log('\n7. FINAL STATE CHECK');
    const finalPeriod = await db.collection('periods').findOne({ _id: openPeriod._id });
    console.log(`Final period status: ${finalPeriod.status}`);
    
    const finalGroup = await db.collection('groups').findOne({ _id: groupObjectId });
    console.log(`Final balance: ₹${finalGroup.currentBalance}`);
    console.log(`Final cash: ₹${finalGroup.cashBalance}`);
    
    console.log('\n=== PERIOD CLOSING WORKFLOW TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error in workflow test:', error);
  } finally {
    await client.close();
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3003/api/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Development server not running on port 3003');
    console.log('Please start the server with: npm run dev');
    return;
  }
  
  await testCompletePeriodClosingWorkflow();
}

main().catch(console.error);
