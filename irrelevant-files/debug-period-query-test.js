const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const TEST_GROUP_ID = '68466fdfad5c6b70fdd420d7';

async function debugPeriodQuery() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        console.log('🔍 Debugging period queries...\n');
        
        // Check all periods for the group
        const allPeriods = await db.collection('periods').find({
            groupId: TEST_GROUP_ID
        }).toArray();
        
        console.log(`📅 Found ${allPeriods.length} periods for group ${TEST_GROUP_ID}:`);
        allPeriods.forEach(period => {
            console.log(`  - Period ${period.periodNumber}: ${period.status} (${period._id})`);
        });
        
        // Check specifically for open periods
        const openPeriods = await db.collection('periods').find({
            groupId: TEST_GROUP_ID,
            status: 'open'
        }).toArray();
        
        console.log(`\n📅 Found ${openPeriods.length} open periods:`);
        openPeriods.forEach(period => {
            console.log(`  - Period ${period.periodNumber}: ${period.status} (${period._id})`);
        });
        
        // Check with different query variations
        const openPeriodsAlt = await db.collection('periods').find({
            groupId: TEST_GROUP_ID,
            status: { $eq: 'open' }
        }).toArray();
        
        console.log(`\n📅 Alternative query found ${openPeriodsAlt.length} open periods`);
        
        // Show the exact document structure
        if (allPeriods.length > 0) {
            console.log('\n📋 Sample period structure:');
            console.log(JSON.stringify(allPeriods[0], null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

debugPeriodQuery().catch(console.error);
