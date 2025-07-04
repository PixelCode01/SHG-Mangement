#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

// Use MongoDB Atlas connection string
const mongoUri = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function findGroups() {
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Check all groups
    console.log('\n=== CHECKING GROUPS ===');
    const groups = await db.collection('Group').find({}).toArray();
    
    if (groups.length) {
      console.log(`Found ${groups.length} groups:`);
      groups.forEach((group, index) => {
        console.log(`\n[${index + 1}] Group:`);
        console.log(`- ID: ${group._id}`);
        console.log(`- Name: ${group.name || 'N/A'}`);
        console.log(`- Created: ${group.createdAt}`);
        console.log(`- Current Balance: ${group.currentBalance || 'N/A'}`);
        console.log(`- Cash Balance: ${group.cashBalance || 'N/A'}`);
      });
      
      // Find group by name "jn"
      const jnGroup = groups.find(g => g.name?.toLowerCase() === 'jn');
      if (jnGroup) {
        console.log('\n=== FOUND JN GROUP ===');
        console.log(`- ID: ${jnGroup._id}`);
        console.log(`- Name: ${jnGroup.name}`);
        
        // Check periods for this group
        console.log('\n=== CHECKING PERIODS FOR JN GROUP ===');
        const periods = await db.collection('GroupPeriodicRecord').find({ 
          groupId: jnGroup._id 
        }).toArray();
        
        if (periods.length) {
          console.log(`Found ${periods.length} periods:`);
          periods.sort((a, b) => a.periodNumber - b.periodNumber);
          
          periods.forEach(period => {
            console.log(`\n[Period #${period.periodNumber}]:`);
            console.log(`- ID: ${period._id}`);
            console.log(`- Status: ${period.status || 'N/A'}`);
            console.log(`- Created: ${period.createdAt}`);
            if (period.closedAt) {
              console.log(`- Closed: ${period.closedAt}`);
            }
          });
          
          // Find open period
          const openPeriod = periods.find(p => p.status === 'open');
          if (openPeriod) {
            console.log('\n=== OPEN PERIOD ===');
            console.log(`- Period #${openPeriod.periodNumber} (ID: ${openPeriod._id})`);
            
            // Check contributions for this period
            console.log('\n=== CHECKING CONTRIBUTIONS FOR THIS PERIOD ===');
            const contributions = await db.collection('MemberContribution').find({ 
              periodId: openPeriod._id 
            }).toArray();
            
            if (contributions.length) {
              console.log(`Found ${contributions.length} contributions:`);
              const paidCount = contributions.filter(c => c.status === 'paid').length;
              console.log(`- Paid: ${paidCount}`);
              console.log(`- Pending: ${contributions.length - paidCount}`);
              
              // Show a sample contribution
              console.log('\nSample contribution:');
              console.log(contributions[0]);
            } else {
              console.log('No contributions found for this period');
            }
            
            // Check members for this group
            console.log('\n=== CHECKING MEMBERS FOR JN GROUP ===');
            const members = await db.collection('Member').find({ 
              groupId: jnGroup._id 
            }).toArray();
            
            if (members.length) {
              console.log(`Found ${members.length} members:`);
              members.forEach((member, index) => {
                if (index < 5) { // Show first 5 members only
                  console.log(`- ${member.name} (ID: ${member._id})`);
                }
              });
              if (members.length > 5) {
                console.log(`... and ${members.length - 5} more`);
              }
            } else {
              console.log('No members found for this group');
            }
          } else {
            console.log('\nNo open period found');
          }
        } else {
          console.log('No periods found for this group');
        }
      } else {
        console.log('\nGroup "jn" not found');
      }
    } else {
      console.log('No groups found in the database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findGroups().catch(console.error);
