const mongoose = require('mongoose');
module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Configure the environment.');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
};
