import { connectedDB } from "../config/db.js";
import {
  runDueJob,
  reconcileDomainTime,
} from "../services/domainWorker.service.js";
import mongoose from "mongoose";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
await connectedDB();
try {
  while (!stopped) {
    await reconcileDomainTime().catch(() =>
      console.error("Domain reconciliation failed; will retry"),
    );
    for (let i = 0; i < 100 && !stopped && (await runDueJob()); i++);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
} finally {
  await mongoose.disconnect();
}
