require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const port = Number(process.env.PORT) || 5000;
connectDB().then(() => app.listen(port, () => console.log(`Inventory API listening on port ${port}`))).catch((error) => {
  console.error('Unable to start the API:', error.message);
  process.exit(1);
});
