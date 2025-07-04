#!/usr/bin/env node

/**
 * Test script for checking database structure and operations directly
 */

const { MongoClient, ObjectId } = require('mongodb');

// Use MongoDB Atlas connection string
const mongoUri = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function testPeriodicRecordWorkflowAPI() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('=== TESTING PERIODIC RECORD WORKFLOW VIA DATABASE + API ===\n');
    
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
    console.log(`Leaders: ${group.leaderId}`);
    
    // Step 2: Get group members
    console.log('\n2. FETCHING GROUP MEMBERS');
    const members = await db.collection('Member').find({ 
      groupId: groupObjectId 
    }).toArray();
    
    if (!members.length) {
      console.log('❌ No members found for this group');
      
      // Let's try to find if members exist with string ID
      const membersWithStringId = await db.collection('Member').find({ 
        groupId: groupId 
      }).toArray();
      
      if (membersWithStringId.length) {
        console.log(`Found ${membersWithStringId.length} members using string ID`);
        console.log(`First member: ${membersWithStringId[0].name}`);
      } else {
        console.log('No members found with string ID either');
      }
      
      // Check all collections to find where members might be
      console.log('\nChecking related collections...');
      
      const collections = await db.listCollections().toArray();
      for (const collection of collections) {
        if (collection.name.toLowerCase().includes('member')) {
          console.log(`Checking collection: ${collection.name}`);
          const sampleDocs = await db.collection(collection.name).find({}).limit(2).toArray();
          
          if (sampleDocs.length) {
            console.log(`Found ${sampleDocs.length} documents`);
            console.log(`Sample structure: ${JSON.stringify(sampleDocs[0], null, 2)}`);
          } else {
            console.log(`No documents in ${collection.name}`);
          }
        }
      }
      
      return;
    }
    
    console.log(`Found ${members.length} members`);
    console.log(`First member: ${members[0].name} (ID: ${members[0]._id})`);
    
    // Step 3: Check existing periodic records
    console.log('\n3. CHECKING EXISTING PERIODIC RECORDS');
    const existingRecords = await db.collection('GroupPeriodicRecord').find({
      groupId: groupObjectId
    }).sort({ createdAt: -1 }).toArray();
    
    if (existingRecords.length === 0) {
      console.log('❌ No existing periodic records found');
      return;
    }
    
    console.log(`Found ${existingRecords.length} periodic records`);
    
    const latestRecord = existingRecords[0];
    console.log(`Latest record: from ${new Date(latestRecord.createdAt).toLocaleDateString()}`);
    console.log(`Record: ${JSON.stringify(latestRecord, null, 2)}`);
    
    // Step 4: Create test periodic record data
    console.log('\n4. CREATING NEW TEST PERIODIC RECORD');
    
    const meetingDate = new Date();
    const recordSequenceNumber = (latestRecord.recordSequenceNumber || 1) + 1;
    const membersPresent = members.length; // Assume all members present
    
    // Simple logic for contributions: each member contributes their expected amount
    const memberContributions = members.map(member => ({
      memberId: member._id,
      memberName: member.name || 'Unknown',
      contribution: group.monthlyContribution || 500,
      status: 'paid'
    }));
    
    // Calculate totals
    const totalCollection = memberContributions.reduce((sum, item) => sum + item.contribution, 0);
    const interestRate = group.interestRate || 7;
    const interestEarned = Math.round(group.cashInHand * (interestRate / 100) / 12);
    
    // Create new record data
    const newRecordData = {
      groupId: groupObjectId,
      meetingDate,
      recordSequenceNumber,
      membersPresent,
      totalCollectionThisPeriod: totalCollection,
      standingAtStartOfPeriod: group.cashInHand + group.balanceInBank,
      cashInBankAtEndOfPeriod: group.balanceInBank + Math.round((totalCollection * 0.7 + Number.EPSILON) * 100) / 100,
      cashInHandAtEndOfPeriod: group.cashInHand + Math.round((totalCollection * 0.3 + Number.EPSILON) * 100) / 100,
      totalGroupStandingAtEndOfPeriod: (group.cashInHand + group.balanceInBank) + totalCollection,
      interestEarnedThisPeriod: interestEarned,
      newContributionsThisPeriod: totalCollection - interestEarned,
      lateFinesCollectedThisPeriod: 0,
      memberRecords: memberContributions,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the record
    const insertResult = await db.collection('GroupPeriodicRecord').insertOne(newRecordData);
    console.log(`✅ Test periodic record created with ID: ${insertResult.insertedId}`);
    console.log(`Total Collection: ₹${totalCollection}`);
    
    // Step 5: Test updating the record
    console.log('\n5. TESTING RECORD UPDATE');
    
    // Increase one member's contribution by 200
    const memberToUpdate = memberContributions[0];
    const updatedContribution = memberToUpdate.contribution + 200;
    
    // Update the member record
    const updatedMemberContributions = memberContributions.map(member => 
      member.memberId.toString() === memberToUpdate.memberId.toString() 
        ? { ...member, contribution: updatedContribution }
        : member
    );
    
    // Recalculate totals
    const updatedTotalCollection = updatedMemberContributions.reduce(
      (sum, item) => sum + item.contribution, 0
    );
    
    // Update the record
    await db.collection('GroupPeriodicRecord').updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          totalCollectionThisPeriod: updatedTotalCollection,
          newContributionsThisPeriod: updatedTotalCollection - interestEarned,
          cashInBankAtEndOfPeriod: group.balanceInBank + Math.round(updatedTotalCollection * 0.3),
          cashInHandAtEndOfPeriod: group.cashInHand + Math.round(updatedTotalCollection * 0.7),
          totalGroupStandingAtEndOfPeriod: (group.cashInHand + group.balanceInBank) + updatedTotalCollection,
          memberRecords: updatedMemberContributions,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ Record updated successfully');
    console.log(`Updated total collection: ₹${updatedTotalCollection} (+ ₹${updatedTotalCollection - totalCollection})`);
    
    // Step 6: Clean up - Remove test record
    console.log('\n6. CLEANING UP TEST DATA');
    await db.collection('GroupPeriodicRecord').deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Test record deleted');
    
    console.log('\n=== PERIODIC RECORD WORKFLOW TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await client.close();
  }
}

testPeriodicRecordWorkflowAPI().catch(console.error);
