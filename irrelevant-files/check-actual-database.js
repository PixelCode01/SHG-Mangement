const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function checkActualDatabase() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        console.log('🔍 Checking actual database collections...\n');
        
        // Check Group collection
        const groups = await db.collection('Group').find({}).toArray();
        console.log(`👥 Groups: ${groups.length} found`);
        groups.forEach(group => {
            console.log(`  - ${group.name} (${group._id})`);
        });
        
        // Check Member collection
        const members = await db.collection('Member').find({}).limit(5).toArray();
        console.log(`\n👤 Members: ${await db.collection('Member').countDocuments()} found (showing first 5)`);
        members.forEach(member => {
            console.log(`  - ${member.name} (Group: ${member.groupId})`);
        });
        
        // Check MemberContribution collection
        const contributions = await db.collection('MemberContribution').find({}).limit(5).toArray();
        console.log(`\n💰 Contributions: ${await db.collection('MemberContribution').countDocuments()} found (showing first 5)`);
        contributions.forEach(contribution => {
            console.log(`  - ₹${contribution.amount} for member ${contribution.memberId} in period ${contribution.periodId}`);
        });
        
        // Check GroupPeriodicRecord collection  
        const periods = await db.collection('GroupPeriodicRecord').find({}).toArray();
        console.log(`\n📅 Group Periodic Records: ${periods.length} found`);
        periods.forEach(period => {
            console.log(`  - Period ${period.periodNumber} for group ${period.groupId}: ${period.status}`);
        });
        
        // Check GroupMemberPeriodicRecord collection
        const memberRecords = await db.collection('GroupMemberPeriodicRecord').find({}).limit(5).toArray();
        console.log(`\n📋 Member Periodic Records: ${await db.collection('GroupMemberPeriodicRecord').countDocuments()} found (showing first 5)`);
        memberRecords.forEach(record => {
            console.log(`  - Member ${record.memberId} in period ${record.periodId}: Standing ₹${record.groupStanding}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkActualDatabase().catch(console.error);
