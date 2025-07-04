const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'shg_management';

async function checkCollections() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    try {
        console.log('=== Checking Database Collections ===\n');
        
        const collections = await db.listCollections().toArray();
        console.log(`📊 Found ${collections.length} collections:`);
        for (const collection of collections) {
            console.log(`   • ${collection.name}`);
            
            // Check a few documents from each collection
            const col = db.collection(collection.name);
            const count = await col.countDocuments();
            console.log(`     - Documents: ${count}`);
            
            if (count > 0 && count < 10) {
                const sample = await col.findOne();
                console.log(`     - Sample keys: ${Object.keys(sample).join(', ')}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkCollections().catch(console.error);
