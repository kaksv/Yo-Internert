import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./env.js";
import { registerPackageRoutes } from "./routes/packages.js";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { registerDevRoutes } from "./routes/dev.js";

const env = loadEnv();
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN?.includes("*") ? true : env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, paymentMode: env.PAYMENT_MODE });
});

registerPackageRoutes(app);
registerPaymentRoutes(app, env);
registerWebhookRoutes(app, env);
registerSessionRoutes(app, env);
registerDevRoutes(app, env);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

const port = env.PORT;
app.listen(port, () => {
  console.log(`hotspot-api listening on :${port} (${env.PAYMENT_MODE})`);
});
