const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'shg_management';

async function testFixedPeriodBehavior() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    try {
        console.log('=== Testing Fixed Period Closure Behavior ===\n');
        
        const groupsCollection = db.collection('Group');
        const periodicRecordsCollection = db.collection('GroupPeriodicRecord');
        const contributionsCollection = db.collection('MemberContribution');
        
        // Get the test group
        const group = await groupsCollection.findOne({ name: 'jh' });
        if (!group) {
            console.log('❌ Test group "jh" not found');
            return;
        }
        console.log(`🎯 Testing group: ${group.name} (ID: ${group._id})`);
        
        // Check current state
        const currentRecords = await periodicRecordsCollection.find({ groupId: group._id }).sort({ recordSequenceNumber: 1 }).toArray();
        console.log(`\n📊 Current Periodic Records: ${currentRecords.length}`);
        
        for (const record of currentRecords) {
            const contributions = await contributionsCollection.find({ groupPeriodicRecordId: record._id }).toArray();
            const createdAt = new Date(record.createdAt);
            const updatedAt = new Date(record.updatedAt);
            const timeDiff = Math.abs(updatedAt.getTime() - createdAt.getTime());
            
            console.log(`   📋 Record #${record.recordSequenceNumber}`);
            console.log(`      - Meeting Date: ${new Date(record.meetingDate).toLocaleDateString()}`);
            console.log(`      - Total Collection: ₹${record.totalCollectionThisPeriod || 0}`);
            console.log(`      - Created: ${createdAt.toLocaleString()}`);
            console.log(`      - Updated: ${updatedAt.toLocaleString()}`);
            console.log(`      - Time Difference: ${timeDiff < 1000 ? 'Never updated' : `${timeDiff/1000}s after creation`}`);
            console.log(`      - Member Contributions: ${contributions.length}`);
            
            // Analyze if this is auto-created
            const isAutoCreated = record.totalCollectionThisPeriod === 0 && timeDiff < 1000;
            console.log(`      - Status: ${isAutoCreated ? '🤖 AUTO-CREATED' : '👥 REAL PERIOD'}`);
        }
        
        console.log('\n🔍 EXPECTED BEHAVIOR ANALYSIS:');
        console.log('   ✅ Auto-created periods should be UPDATED when closed (not create new periods)');
        console.log('   ✅ Real periods should either:');
        console.log('      - Update existing auto-created next period, OR');
        console.log('      - Create new period if no auto-created next period exists');
        console.log('   ✅ Group standing, cash in hand, and cash in bank should be calculated correctly');
        
        // Check if we have potential issues
        const autoCreatedPeriods = currentRecords.filter(r => {
            const timeDiff = Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime());
            return r.totalCollectionThisPeriod === 0 && timeDiff < 1000;
        });
        
        const realPeriods = currentRecords.filter(r => {
            const timeDiff = Math.abs(new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime());
            return r.totalCollectionThisPeriod > 0 || timeDiff >= 1000;
        });
        
        console.log(`\n📈 ANALYSIS RESULTS:`);
        console.log(`   🤖 Auto-created periods: ${autoCreatedPeriods.length}`);
        console.log(`   👥 Real periods: ${realPeriods.length}`);
        
        if (autoCreatedPeriods.length > 1) {
            console.log('   ⚠️  WARNING: Multiple auto-created periods detected!');
            console.log('   💡 This suggests the old logic was creating new periods instead of updating existing ones');
        } else if (autoCreatedPeriods.length === 1) {
            console.log('   ✅ One auto-created period - this is expected for the current open period');
        } else {
            console.log('   ✅ No auto-created periods - all periods have been properly closed');
        }
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('   1. When closing a period, the fixed logic will:');
        console.log('      a. Check if period is auto-created (totalCollection=0 + never updated)');
        console.log('      b. If auto-created: Update existing record with actual data');
        console.log('      c. If real period: Look for existing auto-created next period to update, or create new');
        console.log('   2. Cash allocation will be calculated accurately from contribution data');
        console.log('   3. Group standing will include cash in hand + cash in bank + loan assets');
        
    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        await client.close();
    }
}

testFixedPeriodBehavior().catch(console.error);
