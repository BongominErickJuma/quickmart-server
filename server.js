const env = require('dotenv');
env.config({ path: './config.env' });

const mongoose = require('mongoose');
const app = require('./app');

// const DB = process.env.DB;

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB)
  .then(() =>
    console.log(`DB connection was successfull- ${process.env.NODE_ENV}`)
  )
  .catch((err) => console.log('Error conecting to the database', err));

console.log('Environment: ', process.env.NODE_ENV);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Listening for request on port ${PORT}`);
});
