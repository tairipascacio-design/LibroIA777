import type { Plugin, ViteDevServer } from "vite";
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
} from "./apiRouter";

export function bookApiPlugin(): Plugin {
  return {
    name: "book-api-middleware",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          return next();
        }

        const readBody = (): Promise<{ raw: string; json: any }> => {
          return new Promise((resolve) => {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              try {
                resolve({
                  raw: body,
                  json: body ? JSON.parse(body) : {},
                });
              } catch {
                resolve({ raw: body, json: {} });
              }
            });
          });
        };

        const jsonReq: any = req;
        const jsonRes: any = res;

        if (!jsonRes.json) {
          jsonRes.json = (data: any) => {
            jsonRes.setHeader("Content-Type", "application/json");
            jsonRes.end(JSON.stringify(data));
          };
        }
        if (!jsonRes.status) {
          jsonRes.status = (code: number) => {
            jsonRes.statusCode = code;
            return jsonRes;
          };
        }

        if (req.method === "POST") {
          const parsed = await readBody();
          jsonReq.rawBody = parsed.raw;
          jsonReq.body = parsed.json;
        }

        const url = req.url.split("?")[0];

        if (url === "/api/organize-dictation" && req.method === "POST") {
          return handleOrganizeDictation(jsonReq, jsonRes);
        } else if (url === "/api/refine-chapter" && req.method === "POST") {
          return handleRefineChapter(jsonReq, jsonRes);
        } else if (url === "/api/continuation-prompts" && req.method === "POST") {
          return handleContinuationPrompts(jsonReq, jsonRes);
        } else if (url === "/api/billing/status" && req.method === "GET") {
          return handleBillingStatus(jsonReq, jsonRes);
        } else if (url === "/api/billing/checkout" && req.method === "POST") {
          return handleBillingCheckout(jsonReq, jsonRes);
        } else if (url === "/api/billing/portal" && req.method === "POST") {
          return handleBillingPortal(jsonReq, jsonRes);
        } else if (url === "/api/billing/webhook" && req.method === "POST") {
          return handleBillingWebhook(jsonReq, jsonRes);
        } else if (url === "/api/billing/demo-toggle" && req.method === "POST") {
          return handleBillingDemoToggle(jsonReq, jsonRes);
        } else if (url === "/api/apk-info" && req.method === "GET") {
          return handleApkInfo(jsonReq, jsonRes);
        } else if (url === "/api/apk-base64" && req.method === "GET") {
          return handleApkBase64(jsonReq, jsonRes);
        } else if (
          url === "/api/download-apk" &&
          (req.method === "GET" || req.method === "HEAD")
        ) {
          return handleDownloadApk(jsonReq, jsonRes);
        } else if (url === "/api/download-android-script" && req.method === "GET") {
          return handleDownloadAndroidScript(jsonReq, jsonRes);
        }

        next();
      });
    },
  };
}
