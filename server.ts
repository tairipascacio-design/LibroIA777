import express from "express";
import path from "path";
import dotenv from "dotenv";
import {
  handleOrganizeDictation,
  handleRefineChapter,
  handleContinuationPrompts,
  handleDownloadAndroidScript,
  handleDownloadApk,
  handleApkInfo,
  handleApkBase64,
  handleBillingStatus,
  handleBillingCheckout,
  handleBillingPortal,
  handleBillingWebhook,
  handleBillingDemoToggle,
} from "./server/apiRouter";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(
  express.json({
    limit: "25mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

// AI & Quota-Protected API endpoints
app.post("/api/organize-dictation", handleOrganizeDictation);
app.post("/api/refine-chapter", handleRefineChapter);
app.post("/api/continuation-prompts", handleContinuationPrompts);

// SaaS Billing & Webhook endpoints
app.get("/api/billing/status", handleBillingStatus);
app.post("/api/billing/checkout", handleBillingCheckout);
app.post("/api/billing/portal", handleBillingPortal);
app.post("/api/billing/webhook", handleBillingWebhook);
app.post("/api/billing/demo-toggle", handleBillingDemoToggle);

// Android APK endpoints
app.get("/api/apk-info", handleApkInfo);
app.get("/api/apk-base64", handleApkBase64);
app.get("/api/download-apk", handleDownloadApk);
app.head("/api/download-apk", handleDownloadApk);
app.get("/api/download-android-script", handleDownloadAndroidScript);

// Serve static frontend in production
const distPath = path.resolve(process.cwd(), "dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
