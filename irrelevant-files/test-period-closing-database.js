#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shg_management';

async function testPeriodClosingDirectly() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('=== TESTING PERIOD CLOSING DIRECTLY VIA DATABASE ===\n');
    
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
    
    // Step 2: Calculate totals for period closing
    console.log('2. CALCULATING PERIOD TOTALS');
    
    const totalCollection = contributions.reduce((sum, contrib) => 
      sum + (contrib.status === 'paid' ? contrib.amount : 0), 0
    );
    console.log(`Total Collection: ₹${totalCollection}`);
    
    // Get group members
    const members = await db.collection('members').find({ groupId: groupObjectId }).toArray();
    console.log(`Total Members: ${members.length}`);
    
    // Step 3: Simulate period closing logic
    console.log('\n3. SIMULATING PERIOD CLOSING');
    
    // Calculate cash allocation (simple rule: 70% of collection)
    const cashAllocationPercentage = 0.7;
    const cashAllocated = Math.round(totalCollection * cashAllocationPercentage);
    const remainingForLoans = totalCollection - cashAllocated;
    
    console.log(`Cash Allocated: ₹${cashAllocated} (${cashAllocationPercentage * 100}%)`);
    console.log(`Available for Loans: ₹${remainingForLoans}`);
    
    // Calculate group standing
    const previousClosedPeriods = await db.collection('periods').find({
      groupId: groupObjectId,
      status: 'closed',
      periodNumber: { $lt: openPeriod.periodNumber }
    }).sort({ periodNumber: -1 }).toArray();
    
    let previousGroupStanding = 0;
    if (previousClosedPeriods.length > 0) {
      const lastClosedPeriod = previousClosedPeriods[0];
      const lastPeriodicRecord = await db.collection('periodicrecords').findOne({
        groupId: groupObjectId,
        periodId: lastClosedPeriod._id
      });
      if (lastPeriodicRecord) {
        previousGroupStanding = lastPeriodicRecord.groupStanding || 0;
      }
    }
    
    const newGroupStanding = previousGroupStanding + cashAllocated;
    console.log(`Previous Group Standing: ₹${previousGroupStanding}`);
    console.log(`New Group Standing: ₹${newGroupStanding}`);
    
    // Create member records
    const memberRecords = members.map(member => {
      const memberContribution = contributions.find(c => 
        c.memberId.toString() === member._id.toString()
      );
      
      return {
        memberId: member._id,
        memberName: member.name,
        contribution: memberContribution ? memberContribution.amount : 0,
        status: memberContribution ? memberContribution.status : 'pending',
        cashShare: Math.round(cashAllocated / members.length), // Equal distribution
        loanEligibility: Math.round(remainingForLoans / members.length)
      };
    });
    
    console.log(`Member Records Created: ${memberRecords.length}`);
    
    // Step 4: Actually close the period
    console.log('\n4. CLOSING PERIOD IN DATABASE');
    
    const closedAt = new Date();
    
    // Update period status
    await db.collection('periods').updateOne(
      { _id: openPeriod._id },
      {
        $set: {
          status: 'closed',
          closedAt: closedAt,
          collectionAmount: totalCollection
        }
      }
    );
    
    console.log('✅ Period status updated to closed');
    
    // Create periodic record
    const periodicRecord = {
      groupId: groupObjectId,
      periodId: openPeriod._id,
      periodNumber: openPeriod.periodNumber,
      totalCollection: totalCollection,
      cashAllocated: cashAllocated,
      groupStanding: newGroupStanding,
      memberRecords: memberRecords,
      createdAt: closedAt,
      updatedAt: closedAt
    };
    
    const insertResult = await db.collection('periodicrecords').insertOne(periodicRecord);
    console.log(`✅ Periodic record created: ${insertResult.insertedId}`);
    
    // Update group balances
    const newCashBalance = group.cashBalance + cashAllocated;
    const newCurrentBalance = group.currentBalance + totalCollection;
    
    await db.collection('groups').updateOne(
      { _id: groupObjectId },
      {
        $set: {
          cashBalance: newCashBalance,
          currentBalance: newCurrentBalance,
          updatedAt: closedAt
        }
      }
    );
    
    console.log(`✅ Group balances updated: Cash: ₹${newCashBalance}, Total: ₹${newCurrentBalance}`);
    
    // Step 5: Test record editing
    console.log('\n5. TESTING RECORD EDITING');
    
    const recordToEdit = await db.collection('periodicrecords').findOne({ _id: insertResult.insertedId });
    if (recordToEdit && recordToEdit.memberRecords.length > 0) {
      const memberToEdit = recordToEdit.memberRecords[0];
      const originalContribution = memberToEdit.contribution;
      const newContribution = originalContribution + 100; // Add ₹100
      
      console.log(`Editing ${memberToEdit.memberName}'s contribution: ₹${originalContribution} → ₹${newContribution}`);
      
      // Update the member record
      const updatedMemberRecords = recordToEdit.memberRecords.map(record => 
        record.memberId.toString() === memberToEdit.memberId.toString()
          ? { ...record, contribution: newContribution }
          : record
      );
      
      // Recalculate totals
      const newTotalCollection = updatedMemberRecords.reduce((sum, record) => sum + record.contribution, 0);
      const newCashAllocated = Math.round(newTotalCollection * cashAllocationPercentage);
      const newGroupStandingUpdated = previousGroupStanding + newCashAllocated;
      
      // Update the record
      await db.collection('periodicrecords').updateOne(
        { _id: insertResult.insertedId },
        {
          $set: {
            memberRecords: updatedMemberRecords,
            totalCollection: newTotalCollection,
            cashAllocated: newCashAllocated,
            groupStanding: newGroupStandingUpdated,
            updatedAt: new Date()
          }
        }
      );
      
      console.log('✅ Record edited successfully');
      console.log(`New Total Collection: ₹${newTotalCollection}`);
      console.log(`New Cash Allocated: ₹${newCashAllocated}`);
      console.log(`New Group Standing: ₹${newGroupStandingUpdated}`);
      
      // Also update the contribution record
      await db.collection('contributions').updateOne(
        { periodId: openPeriod._id, memberId: memberToEdit.memberId },
        { $set: { amount: newContribution, updatedAt: new Date() } }
      );
      
      console.log('✅ Original contribution record updated');
    }
    
    // Step 6: Test period reopening
    console.log('\n6. TESTING PERIOD REOPENING');
    
    // Reopen the period
    await db.collection('periods').updateOne(
      { _id: openPeriod._id },
      {
        $set: {
          status: 'open',
          updatedAt: new Date()
        },
        $unset: {
          closedAt: "",
          collectionAmount: ""
        }
      }
    );
    
    console.log('✅ Period reopened');
    
    // Delete the periodic record (since period is reopened)
    await db.collection('periodicrecords').deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Periodic record removed');
    
    // Revert group balances
    await db.collection('groups').updateOne(
      { _id: groupObjectId },
      {
        $set: {
          cashBalance: group.cashBalance,
          currentBalance: group.currentBalance,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ Group balances reverted');
    
    // Step 7: Final verification
    console.log('\n7. FINAL VERIFICATION');
    
    const finalPeriod = await db.collection('periods').findOne({ _id: openPeriod._id });
    console.log(`Final Period Status: ${finalPeriod.status}`);
    
    const finalGroup = await db.collection('groups').findOne({ _id: groupObjectId });
    console.log(`Final Group Balance: ₹${finalGroup.currentBalance}`);
    console.log(`Final Cash Balance: ₹${finalGroup.cashBalance}`);
    
    const remainingRecords = await db.collection('periodicrecords').countDocuments({ periodId: openPeriod._id });
    console.log(`Remaining Periodic Records: ${remainingRecords}`);
    
    console.log('\n=== PERIOD CLOSING WORKFLOW TEST COMPLETE ===');
    console.log('✅ All operations completed successfully');
    
  } catch (error) {
    console.error('❌ Error in workflow test:', error);
  } finally {
    await client.close();
  }
}

testPeriodClosingDirectly().catch(console.error);
