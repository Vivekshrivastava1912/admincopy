const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://copysupport01_db_user:PlSbN6jBaGZyUZ0m@cluster0.p02ss9y.mongodb.net/ecopy?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully to MongoDB!');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    const printjobs = await mongoose.connection.db.collection('printjobs').find({}).toArray();
    console.log(`Found ${printjobs.length} printjobs:`);
    console.log(JSON.stringify(printjobs, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
}

testConnection();
