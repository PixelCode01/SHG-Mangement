#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

// Use MongoDB Atlas connection string
const mongoUri = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function testPeriodicRecordWorkflow() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('=== TESTING PERIODIC RECORD WORKFLOW ===\n');
    
    const db = client.db();
    const groupId = '68466fdfad5c6b70fdd420d7'; // jn group
    const groupObjectId = new ObjectId(groupId);
    
    // Step 1: Get group information
    console.log('1. FETCHING GROUP INFORMATION');
    const group = await db.collection('Group').findOne({ _id: groupObjectId });
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`Group: ${group.name} (ID: ${group._id})`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Balance in Bank: ₹${group.balanceInBank}`);
    console.log(`Total Balance: ₹${group.cashInHand + group.balanceInBank}`);
    
    // Step 2: Check existing periodic records
    console.log('\n2. CHECKING EXISTING PERIODIC RECORDS');
    const existingRecords = await db.collection('GroupPeriodicRecord').find({
      groupId: groupObjectId
    }).sort({ recordSequenceNumber: -1 }).toArray();
    
    if (existingRecords.length === 0) {
      console.log('❌ No existing periodic records found');
      return;
    }
    
    console.log(`Found ${existingRecords.length} periodic records`);
    
    const latestRecord = existingRecords[0];
    console.log(`Latest record: #${latestRecord.recordSequenceNumber} from ${new Date(latestRecord.createdAt).toLocaleDateString()}`);
    console.log(`Total collection: ₹${latestRecord.totalCollectionThisPeriod}`);
    console.log(`Group standing at end of period: ₹${latestRecord.totalGroupStandingAtEndOfPeriod}`);
    
    // Step 3: Create new periodic record (simulating period closing)
    console.log('\n3. CREATING NEW PERIODIC RECORD');
    
    const meetingDate = new Date();
    const newRecordSequenceNumber = (latestRecord.recordSequenceNumber || 0) + 1;
    const membersPresent = 15; // Assuming all members are present
    
    // Simulate collection for this period (random amount for each member)
    const totalCollectionThisPeriod = Math.round(group.memberCount * group.monthlyContribution * (0.9 + Math.random() * 0.2));
    
    // Calculate new standing
    const standingAtStartOfPeriod = latestRecord.totalGroupStandingAtEndOfPeriod || 0;
    const interestEarnedThisPeriod = Math.round(standingAtStartOfPeriod * (group.interestRate / 100) / 12);
    const newContributionsThisPeriod = totalCollectionThisPeriod - interestEarnedThisPeriod;
    
    // Update cash balances (simulating allocation)
    const cashAllocationPercent = 0.7; // 70% to cash in hand
    const cashInHandIncrease = Math.round(totalCollectionThisPeriod * cashAllocationPercent);
    const cashInBankIncrease = totalCollectionThisPeriod - cashInHandIncrease;
    
    const cashInHandAtEndOfPeriod = group.cashInHand + cashInHandIncrease;
    const cashInBankAtEndOfPeriod = group.balanceInBank + cashInBankIncrease;
    const totalGroupStandingAtEndOfPeriod = standingAtStartOfPeriod + totalCollectionThisPeriod;
    
    // Create the new periodic record
    const newPeriodicRecord = {
      groupId: groupObjectId,
      meetingDate: meetingDate,
      recordSequenceNumber: newRecordSequenceNumber,
      membersPresent: membersPresent,
      totalCollectionThisPeriod: totalCollectionThisPeriod,
      standingAtStartOfPeriod: standingAtStartOfPeriod,
      cashInBankAtEndOfPeriod: cashInBankAtEndOfPeriod,
      cashInHandAtEndOfPeriod: cashInHandAtEndOfPeriod,
      totalGroupStandingAtEndOfPeriod: totalGroupStandingAtEndOfPeriod,
      interestEarnedThisPeriod: interestEarnedThisPeriod,
      newContributionsThisPeriod: newContributionsThisPeriod,
      lateFinesCollectedThisPeriod: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the new record
    const insertResult = await db.collection('GroupPeriodicRecord').insertOne(newPeriodicRecord);
    console.log(`✅ New periodic record created with ID: ${insertResult.insertedId}`);
    console.log(`Record sequence number: #${newRecordSequenceNumber}`);
    console.log(`Total collection: ₹${totalCollectionThisPeriod}`);
    console.log(`New group standing: ₹${totalGroupStandingAtEndOfPeriod}`);
    
    // Step 4: Update group with new balances
    console.log('\n4. UPDATING GROUP BALANCES');
    await db.collection('Group').updateOne(
      { _id: groupObjectId },
      { 
        $set: {
          cashInHand: cashInHandAtEndOfPeriod,
          balanceInBank: cashInBankAtEndOfPeriod,
          updatedAt: new Date()
        }
      }
    );
    console.log('✅ Group balances updated');
    console.log(`New cash in hand: ₹${cashInHandAtEndOfPeriod}`);
    console.log(`New balance in bank: ₹${cashInBankAtEndOfPeriod}`);
    console.log(`New total balance: ₹${cashInHandAtEndOfPeriod + cashInBankAtEndOfPeriod}`);
    
    // Step 5: Test editing the record
    console.log('\n5. TESTING RECORD EDITING');
    
    // Simulate changing the collection amount
    const additionalCollection = 500; // Add ₹500 to total collection
    const newTotalCollection = totalCollectionThisPeriod + additionalCollection;
    
    // Recalculate all derived values
    const newInterestEarned = interestEarnedThisPeriod; // Interest doesn't change
    const newContributions = newContributionsThisPeriod + additionalCollection;
    
    // Update cash balances based on updated collection
    const additionalCashInHand = Math.round(additionalCollection * cashAllocationPercent);
    const additionalCashInBank = additionalCollection - additionalCashInHand;
    
    const updatedCashInHand = cashInHandAtEndOfPeriod + additionalCashInHand;
    const updatedCashInBank = cashInBankAtEndOfPeriod + additionalCashInBank;
    const updatedGroupStanding = totalGroupStandingAtEndOfPeriod + additionalCollection;
    
    // Update the record
    await db.collection('GroupPeriodicRecord').updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          totalCollectionThisPeriod: newTotalCollection,
          newContributionsThisPeriod: newContributions,
          cashInHandAtEndOfPeriod: updatedCashInHand,
          cashInBankAtEndOfPeriod: updatedCashInBank,
          totalGroupStandingAtEndOfPeriod: updatedGroupStanding,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ Record updated successfully');
    console.log(`Updated total collection: ₹${newTotalCollection} (+₹${additionalCollection})`);
    console.log(`Updated group standing: ₹${updatedGroupStanding}`);
    
    // Step 6: Also update group balances
    console.log('\n6. UPDATING GROUP BALANCES AGAIN');
    await db.collection('Group').updateOne(
      { _id: groupObjectId },
      { 
        $set: {
          cashInHand: updatedCashInHand,
          balanceInBank: updatedCashInBank,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ Group balances updated again');
    console.log(`Final cash in hand: ₹${updatedCashInHand}`);
    console.log(`Final balance in bank: ₹${updatedCashInBank}`);
    console.log(`Final total balance: ₹${updatedCashInHand + updatedCashInBank}`);
    
    // Step 7: Delete the test record to clean up
    console.log('\n7. CLEANING UP TEST RECORD');
    await db.collection('GroupPeriodicRecord').deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Test record deleted');
    
    // Step 8: Restore original group balances
    console.log('\n8. RESTORING ORIGINAL GROUP BALANCES');
    await db.collection('Group').updateOne(
      { _id: groupObjectId },
      { 
        $set: {
          cashInHand: group.cashInHand,
          balanceInBank: group.balanceInBank,
          updatedAt: new Date()
        }
      }
    );
    console.log('✅ Group balances restored');
    
    console.log('\n=== PERIODIC RECORD WORKFLOW TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error in workflow test:', error);
  } finally {
    await client.close();
  }
}

testPeriodicRecordWorkflow().catch(console.error);
