import mongoose from 'mongoose';
import { env } from './env.js';

export const connectedDB = async () => {
  try {
    await mongoose.connect(env.mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
      throw new Error('Marketplace writes require an Atlas cluster or replica set. No local configuration was changed.');
    }
    const seats = await mongoose.connection.db.listCollections({ name: 'bookingseats' }).toArray();
    if (seats.length) {
      const indexes = await mongoose.connection.db.collection('bookingseats').indexes();
      if (indexes.some(index => index.key.expiresAt && index.expireAfterSeconds !== undefined)) {
        throw new Error('Legacy seat TTL index detected. Review and apply migrate:marketplace before starting the API.');
      }
    }
    // Build declared constraints before accepting traffic; never drop indexes here.
    for (const model of Object.values(mongoose.models)) await model.createIndexes();
    console.log('Database connected; transaction topology and indexes ready.');
  } catch (error) {
    await mongoose.disconnect();
    // Driver errors may contain connection credentials; keep startup output generic.
    throw new Error('Database readiness failed. Check Atlas access, transaction support, migration and unique indexes.', { cause: error });
  }
};

export default connectedDB;
