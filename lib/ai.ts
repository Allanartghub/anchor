// AI service abstraction: Hugging Face Router (OpenAI-compatible) with safe fallbacks
// For Anchor guide (server-side only)

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// IMPORTANT: do NOT hardcode secrets. Only read from env.
// Prefer HF_TOKEN; allow HUGGINGFACE_API_KEY as a fallback for your existing env naming.
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2:novita";
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || DEFAULT_MODEL;

// Debug: Log env vars on module load
if (process.env.NODE_ENV !== 'production') {
  console.log('[AI Module] HF_TOKEN loaded:', HF_TOKEN ? `${HF_TOKEN.substring(0, 10)}...` : 'MISSING');
  console.log('[AI Module] HUGGINGFACE_MODEL:', HUGGINGFACE_MODEL);
}

const HF_ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

// System prompt for Anchor - calm, supportive, non-clinical mental load companion
const ANCHOR_SYSTEM_PROMPT = `You are Anchor, a calm and supportive mental load companion based in Ireland. Your role is to help international postgraduate students (first 12 months in Ireland) reflect on their mental load and identify small, realistic ways to reduce it.

CONTEXT:
- You are supporting international postgraduate students in their first 12 months in Ireland
- All guidance should be non-clinical, practical, and preventive

MENTAL LOAD FOCUS:
- Focus on pressure points: academic load, financial load, belonging & social load, administrative & immigration load, work–life & time load, health & energy load, future & stability load
- Use plain language and short responses (2-3 sentences max)
- Reflect what you hear and ask one gentle, specific follow-up question
- Avoid generic wellness advice or broad emotional exploration

IMPORTANT GUIDELINES:
- You are NOT a therapist or medical professional
- Never provide medical advice or diagnoses
- If the user mentions self-harm, suicide, or immediate danger, respond with empathy (crisis resources are: Samaritans 116 123, Pieta House 1800 247 247, Aware 1800 80 48 48, Turn2me.ie online support)
- Keep responses warm, empathetic, and brief (2-3 sentences max)
- Use calm, non-judgmental language
- Never use red/green labels or "good/bad" judgments
- If unsure, encourage speaking to a professional or calling a crisis line

IMPORTANT: Always respond directly to the user with a caring message. Do not provide internal reasoning or thinking blocks. Just give a warm, supportive response.`;

/**
 * Call Anchor AI to generate a response.
 * Uses Hugging Face Router API with an ordered fallback model list.
 */
export async function callSereneAI(
  userMessage: string,
  domainContext?: string
): Promise<AIResponse> {
  console.log("[Anchor AI] Generating response...");

  const contextualMessage =
    domainContext && domainContext !== "null"
      ? `[User's current load domain: ${domainContext}]\n\n${userMessage}`
      : userMessage;

  if (!HF_TOKEN || HF_TOKEN.trim() === "") {
    console.log("[Anchor AI] ⚠️ No HF token configured. Offline mode.");
    return { success: false, error: "AI service unavailable (offline mode)" };
  }

  try {
    return await tryHuggingFaceRouter(contextualMessage);
  } catch (error) {
    console.warn(
      "[Anchor AI] Hugging Face Router failed:",
      error instanceof Error ? error.message : error
    );
    return { success: false, error: "AI service unavailable" };
  }
}

/**
 * Router-based chat completions with model fallback.
 * NOTE: router models often need a provider suffix like `:hf-inference`.
 */
async function tryHuggingFaceRouter(userMessage: string): Promise<AIResponse> {
  if (!HF_TOKEN) throw new Error("HF token not configured");

  // Deduplicated model list (your env model first, then a known-good fallback)
  const models = [...new Set([HUGGINGFACE_MODEL, DEFAULT_MODEL])];

  for (const model of models) {
    console.log(`[HF Router] Trying model: ${model}`);
    console.log(`[HF Router] Token present: ${HF_TOKEN ? `${HF_TOKEN.substring(0, 10)}...` : 'MISSING'}`);
    console.log(`[HF Router] URL: ${HF_ROUTER_CHAT_URL}`);

    // 12s timeout per attempt (fail fast for demos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    let rawText = "";

    try {
      res = await fetch(HF_ROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: ANCHOR_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 160,
        }),
        signal: controller.signal,
      });

      rawText = await res.text().catch(() => "");
    } catch (err) {
      const emsg = err instanceof Error ? err.message : String(err);
      console.warn(`[HF Router] Request error for ${model}:`, emsg);
      clearTimeout(timeoutId);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      console.error(
        `[HF Router] ❌ ${model} responded ${res.status}: ${rawText.substring(0, 250)}`
      );

      // Common "try next" statuses: auth, access, rate limit, model loading/unavailable
      if ([400, 401, 403, 404, 429, 503].includes(res.status)) {
        console.warn(`[HF Router] ⚠️ Model ${model} unavailable (${res.status}). Trying next...`);
        continue;
      }

      throw new Error(`Hugging Face Router error ${res.status}`);
    }

    // Parse OpenAI-compatible response
    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      console.warn("[HF Router] Failed to parse JSON. Trying next model...");
      continue;
    }

    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";

    let message = (content || "").trim();
    
    console.log(`[HF Router] Raw response (first 150 chars): ${message.substring(0, 150)}`);

    // Sanitize FIRST to remove all artifacts, THEN truncate
    message = sanitizeModelOutput(message);
    
    console.log(`[HF Router] Sanitized response length: ${message.length}, content preview: ${message.substring(0, 100)}`);
    
    // Keep it brief and safe for your UX
    message = message.substring(0, 500);

    if (message.length < 5) {
      console.warn(`[HF Router] Response too short after sanitization (${message.length} chars). Trying next model...`);
      continue;
    }

    console.log("[HF Router] ✓ Valid response from", model);
    return { success: true, message };
  }

  throw new Error("All Hugging Face Router model attempts failed.");
}

/**
 * Remove common artifacts and keep output clean.
 */
function sanitizeModelOutput(text: string): string {
  let sanitized = (text || "");
  
  // Try to extract content after closing </think> tags
  const thinkMatch = sanitized.match(/<\/think>\s*([\s\S]*)/i);
  if (thinkMatch && thinkMatch[1] && thinkMatch[1].trim().length > 0) {
    sanitized = thinkMatch[1];
  } else {
    // If no content after </think>, try to extract from within <think>...</think>
    const withinThink = sanitized.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/i);
    if (withinThink && withinThink[2] && withinThink[2].trim().length > 0) {
      sanitized = withinThink[2];
    }
  }
  
  // Now remove remaining artifacts
  return sanitized
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s{3,}/g, " ")
    .trim();
}

/**
 * Check for high-risk trigger phrases (for audit flagging without storing full text)
 * Returns true if any risk triggers detected
 * Detects: self-harm, suicide, self-destruction, self-hate, and crisis phrases
 */
export function checkForRiskTriggers(text: string): boolean {
  const riskPhrases = [
    // Self-harm phrases
    "kill myself",
    "cut myself",
    "harm myself",
    "hurt myself",
    "injure myself",
    "self-harm",
    "self harm",
    
    // Self-hatred
    "i hate myself",
    "hate myself",
    "self-hate",
    "self hate",
    "worthless",
    "no worth",
    "don't deserve",
    "don't deserve to live",
    "undeserving of",
    
    // Self-destruction & Intent
    "destroy myself",
    "ruin my life",
    "end it all",
    "end it",
    "end my life",
    "end my suffering",
    "want to die",
    "i want to die",
    "don't want to live",
    "do not want to live",
    "dont want to live",
    
    // Suicide-related
    "suicide",
    "suicidal",
    "take my life",
    "going to die",
    "no point living",
    "no reason to live",
    "better off dead",
    "everyone would be better off",
    "not worth living",
    
    // Crisis/Danger
    "not safe",
    "in danger",
    "immediate danger",
    "going to hurt",
    "going to harm",
  ];

  const lowerText = (text || "").toLowerCase();
  return riskPhrases.some((phrase) => lowerText.includes(phrase));
}

/**
 * Get Ireland-specific crisis resources message for immediate support
 * Used when risk triggers detected to provide emergency contact information
 */
export function getIrelandCrisisResources(): string {
  return `💙 **You Don't Have To Face This Alone**

If you're in crisis or having thoughts of self-harm, please reach out to someone who can help:

**Immediate Support (Ireland):**
🤝 **Samaritans** - 116 123 (24/7, free, confidential)
🏥 **Pieta House** - 1800 247 247 (suicide & self-harm support)
💬 **Pieta House Text** - Text HELP to 51444
🧠 **Aware** - 1800 80 48 48 (depression & bipolar support)
👥 **Turn2me.ie** - Online counselling & support (www.turn2me.ie)
👨‍👩‍👧 **Parentline** - 1800 93 24 69 (if parenting-related)

**In Immediate Danger:** Call 999 (Emergency Services)

Your life matters. These services are trained to help, and talking to someone can make a real difference. 💙`;
}
/**
 * Generate a human-readable session title
 * Format: "Today · Domain" or "Feb 5 · Domain"
 * Used for session labels in chat history UI
 */
export function generateSessionTitle(startedAt: string, domainContext?: string | null): string {
  const date = new Date(startedAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  let dateLabel = '';
  if (dateStr === todayStr) {
    dateLabel = 'Today';
  } else if (dateStr === yesterdayStr) {
    dateLabel = 'Yesterday';
  } else {
    // Format: "Feb 5"
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    dateLabel = `${month} ${day}`;
  }

  const domainLabel = domainContext || 'Session';
  return `${dateLabel} · ${domainLabel}`;
}