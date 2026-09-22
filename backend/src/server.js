import app from "./app.js";
import { connectedDB } from "./config/db.js";
import { env } from "./config/env.js";
import { startFxRateScheduler } from "./services/fxRate.service.js";
import mongoose from 'mongoose';

async function startServer() {
  try {
    await connectedDB();
    startFxRateScheduler();

    const server = app.listen(env.port, "0.0.0.0", () => {
      console.log(`Backend server running on port ${env.port}`);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(async () => { await mongoose.disconnect(); process.exit(0); });
      setTimeout(() => process.exit(1), 10000).unref();
    });
  } catch (error) {
    console.error("Failed to start backend server:", error.message);
    process.exit(1);
  }
}

startServer();
