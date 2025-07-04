#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

// Use MongoDB Atlas connection string
const mongoUri = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function inspectSchema() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const jnGroupId = '68466fdfad5c6b70fdd420d7';
    
    // Examine Group schema
    console.log('\n=== GROUP SCHEMA ===');
    const group = await db.collection('Group').findOne({ _id: new ObjectId(jnGroupId) });
    console.log(JSON.stringify(group, null, 2));
    
    // Examine Period schema
    console.log('\n=== GROUP PERIODIC RECORD SCHEMA ===');
    const period = await db.collection('GroupPeriodicRecord').findOne({ groupId: new ObjectId(jnGroupId) });
    console.log(JSON.stringify(period, null, 2));
    
    // Check latest period and its structure
    console.log('\n=== CHECKING LATEST PERIOD ===');
    const periods = await db.collection('GroupPeriodicRecord').find({ 
      groupId: new ObjectId(jnGroupId)
    }).sort({ createdAt: -1 }).toArray();
    
    if (periods.length) {
      const latestPeriod = periods[0];
      console.log(`Latest period ID: ${latestPeriod._id}`);
      console.log(`Created: ${latestPeriod.createdAt}`);
      
      // Check if there's an 'isOpen' field instead of status
      console.log(`Is Open: ${latestPeriod.isOpen !== undefined ? latestPeriod.isOpen : 'field not present'}`);
      console.log(`Is Current: ${latestPeriod.isCurrent !== undefined ? latestPeriod.isCurrent : 'field not present'}`);
      
      // Check if there are contributions for this period
      console.log('\n=== CONTRIBUTIONS FOR LATEST PERIOD ===');
      const contributions = await db.collection('MemberContribution').find({ 
        periodId: latestPeriod._id 
      }).toArray();
      
      if (contributions.length) {
        console.log(`Found ${contributions.length} contributions`);
        console.log(`First contribution: ${JSON.stringify(contributions[0], null, 2)}`);
      } else {
        console.log('No contributions found for this period');
      }
      
      // Check members for this group
      console.log('\n=== MEMBERS FOR JN GROUP ===');
      const members = await db.collection('Member').find({ 
        groupId: new ObjectId(jnGroupId)
      }).toArray();
      
      if (members.length) {
        console.log(`Found ${members.length} members`);
        console.log(`First member: ${JSON.stringify(members[0], null, 2)}`);
      } else {
        console.log('No members found for this group');
      }
    } else {
      console.log('No periods found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectSchema().catch(console.error);
