// config/db.js — Mongoose connection with reconnection backoff (Section 10)
import mongoose from 'mongoose';
import { env } from './env.js';

const RETRY_DELAY_MS = 5000;

export default async function connectDB() {
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected — attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.info('MongoDB reconnected.');
  });

  while (true) {
    try {
      await mongoose.connect(env.mongoUri);
      console.info('MongoDB connected.');
      return;
    } catch (err) {
      console.error(`MongoDB connection failed: ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
