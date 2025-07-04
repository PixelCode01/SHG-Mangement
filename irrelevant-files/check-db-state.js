const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'shg_management';

async function checkCurrentState() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    try {
        console.log('=== Checking Current State for Testing ===\n');
        
        // Check GroupPeriodicRecord (these are the closed periods)
        const periodicRecordsCollection = db.collection('GroupPeriodicRecord');
        const periodicRecords = await periodicRecordsCollection.find({}).sort({ recordSequenceNumber: 1 }).toArray();
        
        console.log(`📊 GroupPeriodicRecord (Closed Periods): ${periodicRecords.length}`);
        for (const record of periodicRecords) {
            console.log(`   📋 Record #${record.recordSequenceNumber}`);
            console.log(`      - Meeting Date: ${new Date(record.meetingDate).toLocaleDateString()}`);
            console.log(`      - Total Collection: ₹${record.totalCollectionThisPeriod || 0}`);
            console.log(`      - Created: ${new Date(record.createdAt).toLocaleString()}`);
        }
        
        // Check MemberContribution
        const contributionsCollection = db.collection('MemberContribution');
        const contributions = await contributionsCollection.find({}).toArray();
        
        console.log(`\n💰 MemberContribution: ${contributions.length}`);
        if (contributions.length > 0) {
            const sample = contributions[0];
            console.log(`   📋 Sample contribution keys: ${Object.keys(sample).join(', ')}`);
            
            // Group by period/meeting date to understand the structure
            const byDate = {};
            for (const contrib of contributions) {
                const dateKey = contrib.meetingDate ? new Date(contrib.meetingDate).toLocaleDateString() : 'no-date';
                if (!byDate[dateKey]) byDate[dateKey] = [];
                byDate[dateKey].push(contrib);
            }
            
            console.log('   📅 Contributions by date:');
            for (const [date, contribs] of Object.entries(byDate)) {
                console.log(`      - ${date}: ${contribs.length} contributions`);
            }
        }
        
        // Check Group info
        const groupsCollection = db.collection('Group');
        const group = await groupsCollection.findOne({ name: 'fds' });
        if (group) {
            console.log(`\n👥 Group "${group.name}":`)
            console.log(`   - Member Count: ${group.memberCount || 'N/A'}`);
            console.log(`   - Monthly Contribution: ₹${group.monthlyContribution || 'N/A'}`);
            console.log(`   - Collection Frequency: ${group.collectionFrequency || 'N/A'}`);
            console.log(`   - Cash in Hand: ₹${group.cashInHand || 0}`);
            console.log(`   - Balance in Bank: ₹${group.balanceInBank || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkCurrentState().catch(console.error);
