#!/usr/bin/env node



const { MongoClient, ObjectId } = require('mongodb');

// Use MongoDB Atlas connection string
const mongoUri = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function checkCollections() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== AVAILABLE COLLECTIONS ===');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check Groups collection
    const groupsCollection = collections.find(c => 
      c.name.toLowerCase().includes('group') && !c.name.toLowerCase().includes('periodic')
    )?.name || 'Group';
    
    console.log(`\n=== CHECKING ${groupsCollection} COLLECTION ===`);
    const groupId = '68466fdfad5c6b70fdd420d7'; // jn group
    
    // First try with string ID
    console.log(`Looking for group with ID: ${groupId}`);
    let group = await db.collection(groupsCollection).findOne({ _id: groupId });
    
    if (!group) {
      // Try with ObjectId
      console.log('Not found with string ID, trying with ObjectId...');
      group = await db.collection(groupsCollection).findOne({ _id: new ObjectId(groupId) });
    }
    
    if (group) {
      console.log('✅ Group found:');
      console.log(`- ID: ${group._id}`);
      console.log(`- Name: ${group.name || 'N/A'}`);
      console.log(`- Current Balance: ${group.currentBalance || 'N/A'}`);
      console.log(`- Cash Balance: ${group.cashBalance || 'N/A'}`);
    } else {
      console.log('❌ Group not found');
    }
    
    // Check Periods collection
    const periodsCollection = collections.find(c => 
      c.name.toLowerCase().includes('period') || c.name === 'Period'
    )?.name || 'Period';
    
    console.log(`\n=== CHECKING ${periodsCollection} COLLECTION ===`);
    
    // Try both ways to query periods
    let periods = await db.collection(periodsCollection).find({ 
      groupId: groupId 
    }).toArray();
    
    if (!periods.length) {
      console.log('Not found with string groupId, trying with ObjectId...');
      periods = await db.collection(periodsCollection).find({ 
        groupId: new ObjectId(groupId) 
      }).toArray();
    }
    
    if (periods.length) {
      console.log(`Found ${periods.length} periods:`);
      periods.forEach(period => {
        console.log(`- ID: ${period._id}, Number: ${period.periodNumber}, Status: ${period.status || 'N/A'}`);
      });
      
      // Find open period
      const openPeriod = periods.find(p => p.status === 'open');
      if (openPeriod) {
        console.log('\n✅ Open period found:');
        console.log(`- ID: ${openPeriod._id}`);
        console.log(`- Period Number: ${openPeriod.periodNumber}`);
      } else {
        console.log('\n❌ No open period found');
      }
    } else {
      console.log('❌ No periods found for this group');
    }
    
    // Check Contributions collection
    const contribCollection = collections.find(c => 
      c.name.toLowerCase().includes('contrib') || c.name === 'Contribution'
    )?.name || 'Contribution';
    
    console.log(`\n=== CHECKING ${contribCollection} COLLECTION ===`);
    
    if (periods.length) {
      const latestPeriod = periods.reduce((latest, current) => 
        (latest.periodNumber > current.periodNumber) ? latest : current
      );
      
      // Try to find contributions using period ID
      let contributions = await db.collection(contribCollection).find({ 
        periodId: latestPeriod._id 
      }).toArray();
      
      if (!contributions.length) {
        console.log('Not found with direct periodId, trying with ObjectId...');
        contributions = await db.collection(contribCollection).find({ 
          periodId: new ObjectId(latestPeriod._id) 
        }).toArray();
      }
      
      if (contributions.length) {
        console.log(`Found ${contributions.length} contributions for period #${latestPeriod.periodNumber}`);
        const paidCount = contributions.filter(c => c.status === 'paid').length;
        console.log(`- Paid: ${paidCount}`);
        console.log(`- Pending: ${contributions.length - paidCount}`);
        
        // Show a sample contribution
        console.log('\nSample contribution structure:');
        console.log(JSON.stringify(contributions[0], null, 2));
      } else {
        console.log('❌ No contributions found for this period');
      }
    }
    
    // Check members collection
    const membersCollection = collections.find(c => 
      c.name.toLowerCase().includes('member') && !c.name.toLowerCase().includes('contrib')
    )?.name || 'Member';
    
    console.log(`\n=== CHECKING ${membersCollection} COLLECTION ===`);
    
    // Try both ways to query members
    let members = await db.collection(membersCollection).find({ 
      groupId: groupId 
    }).toArray();
    
    if (!members.length) {
      console.log('Not found with string groupId, trying with ObjectId...');
      members = await db.collection(membersCollection).find({ 
        groupId: new ObjectId(groupId) 
      }).toArray();
    }
    
    if (members.length) {
      console.log(`Found ${members.length} members in group`);
      console.log('\nSample member structure:');
      console.log(JSON.stringify(members[0], null, 2));
    } else {
      console.log('❌ No members found for this group');
    }
    
    // Check periodic records collection
    const recordsCollection = collections.find(c => 
      c.name.toLowerCase().includes('periodic')
    )?.name || 'PeriodicRecord';
    
    console.log(`\n=== CHECKING ${recordsCollection} COLLECTION ===`);
    
    // Try both ways to query records
    let records = await db.collection(recordsCollection).find({ 
      groupId: groupId 
    }).toArray();
    
    if (!records.length) {
      console.log('Not found with string groupId, trying with ObjectId...');
      records = await db.collection(recordsCollection).find({ 
        groupId: new ObjectId(groupId) 
      }).toArray();
    }
    
    if (records.length) {
      console.log(`Found ${records.length} periodic records for group`);
      console.log('\nSample record structure:');
      console.log(JSON.stringify(records[0], null, 2));
    } else {
      console.log('❌ No periodic records found for this group');
    }

    console.log('\n=== DATABASE INSPECTION COMPLETE ===');
    
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkCollections().catch(console.error);
