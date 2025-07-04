const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'shg_management';

async function checkGroups() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    try {
        console.log('=== Checking Available Groups ===\n');
        
        const groupsCollection = db.collection('Group');
        const groups = await groupsCollection.find({}).toArray();
        
        console.log(`📊 Found ${groups.length} groups:`);
        for (const group of groups) {
            console.log(`   • ${group.name} (ID: ${group._id})`);
        }
        
        return groups;
    } catch (error) {
        console.error('❌ Error:', error);
        return [];
    } finally {
        await client.close();
    }
}

checkGroups().catch(console.error);
