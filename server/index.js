import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";

const app = express();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be configured on the server");
}
if (!process.env.FIREBASE_PROJECT_ID) {
  throw new Error("FIREBASE_PROJECT_ID must be configured on the server");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  admin.initializeApp({
    credential: serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson))
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "96kb" }));

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user.uid,
  message: { error: "Too many messages. Please wait a minute before trying again." },
});

async function verifyFirebaseToken(req, res, next) {
  const authorization = req.header("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Authentication is required." });
  }

  try {
    req.user = await admin.auth().verifyIdToken(match[1]);
    return next();
  } catch {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/ai/chat", verifyFirebaseToken, chatLimiter, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
    return res.status(400).json({ error: "Include between 1 and 20 recent messages." });
  }

  const normalizedMessages = [];
  for (const message of messages) {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > 4000
    ) {
      return res.status(400).json({ error: "Messages must contain valid text of 1–4000 characters." });
    }
    normalizedMessages.push({ role: message.role, content: message.content.trim() });
  }

  if (normalizedMessages[normalizedMessages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The latest message must be from you." });
  }

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: normalizedMessages,
      instructions: "You are the AI assistant in the Avira Technologies CRM. Provide clear, professional, concise help. You do not have access to CRM records and must not claim to have read or changed them. No CRM operations or tools are enabled.",
      max_output_tokens: 1200,
      store: false,
    });
    return res.json({ message: response.output_text || "I couldn't generate a response. Please try again." });
  } catch (error) {
    console.error("OpenAI chat request failed", error?.status || error?.name || "unknown error");
    return res.status(502).json({ error: "The AI assistant is temporarily unavailable. Please try again shortly." });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "The request is too large." });
  }
  console.error("API request failed", error?.name || "unknown error");
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => console.log(`AI API listening on port ${port}`));
