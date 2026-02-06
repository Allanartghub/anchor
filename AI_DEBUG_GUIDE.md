# AI Hanging Issue - Analysis & Fixes

## Problem: "Sending" - No Response from Serene

When users send a message, the chat gets stuck on "Sending..." indefinitely with no response.

---

## Root Causes Identified

### 1. **No Timeout on API Requests (Primary Issue)**
- The HuggingFace API fetch had a 25-second timeout, which is too long
- If the API was slow or unresponsive, users would wait 25 seconds seeing "Sending..."
- The overall `/api/chat` route had no timeout at all

### 2. **Slow HuggingFace Model**
- The previous implementation tried Mistral-7B-Instruct-v0.2, which is large and slow on the free tier
- Free tier models take much longer to load/respond, causing timeouts

### 3. **Poor Error Handling**
- When the AI failed, there was no immediate fallback
- Errors weren't being logged properly, making it hard to diagnose

### 4. **No Offline Fallback Trigger**
- The system had an offline fallback, but it wasn't being triggered quickly enough
- Users couldn't get responses from helpful micro-suggestions while waiting for API

---

## Solutions Implemented

### 1. **Reduced Timeout from 25s → 10s**
**File:** [lib/ai.ts](lib/ai.ts)

```typescript
// Create an abort controller with 10 second timeout (fail fast)
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  console.warn('[HF API] Request timeout after 10s');
  controller.abort();
}, 10000);
```

**Why:** 10 seconds is long enough for most HuggingFace responses, but short enough to fail fast and use offline fallback if the API is slow.

### 2. **Switched from Mistral to GPT2**
**File:** [lib/ai.ts](lib/ai.ts)

```typescript
// Before: mistralai/Mistral-7B-Instruct-v0.2 (slow on free tier)
// After: gpt2 (fast, reliable, always available)
const modelEndpoint = 'https://router.huggingface.co/models/gpt2';
```

**Why:**
- GPT2 is smaller and faster
- Always available and ready (no loading delays)
- More reliable on free tier
- Reduces timeout risk significantly

### 3. **Added Overall Request Timeout to API Route**
**File:** [app/api/chat/route.ts](app/api/chat/route.ts)

```typescript
export async function POST(request: NextRequest) {
  try {
    // Set a 20-second timeout for the entire request
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 20 seconds')), 20000)
    );

    const requestPromise = handleChatRequest(request);
    return await Promise.race([requestPromise, timeoutPromise]);
```

**Why:** Ensures the API never hangs indefinitely. If anything takes >20s, user gets error and can retry.

### 4. **Improved Diagnostic Logging**
**Files:** [lib/ai.ts](lib/ai.ts), [app/api/chat/route.ts](app/api/chat/route.ts)

```typescript
console.log('[Serene AI] Generating response...');
console.log('[Serene AI] Attempting Ollama...');
console.log('[HF API] Request timeout after 10s');
console.log('[Chat API] AI response received successfully');
console.log('[Chat API] Using offline fallback - AI service unavailable');
```

**Why:** Tagged logs make it easy to trace what's happening in the network console when debugging.

### 5. **Better Response Validation**
**File:** [lib/ai.ts](lib/ai.ts)

```typescript
// Reject response if too short - will trigger fallback
if (!message || message.length < 3) {
  throw new Error('Response too short');
}

// Limit response to 300 chars and remove artifacts
message = message.trim().substring(0, 300);
message = message.replace(/<\|.*?\|>/g, '').replace(/\[.*?\]/g, '').trim();
```

**Why:** Ensures only valid responses are returned; invalid ones trigger fallback.

---

## Testing the Fix

### Test 1: Check Normal Response (with internet/valid API)
1. Go to `/chat`
2. Send: "How are you?"
3. Should respond within **2-5 seconds** with a GPT2 response
4. Check browser console → should see:
   ```
   [Serene AI] Generating response...
   [Serene AI] Attempting Ollama... (or immediate skip if not running)
   [Serene AI] Attempting HuggingFace API...
   [HF API] Response received
   [HF API] ✓ Valid response: ...
   [Serene AI] ✓ Got response from HuggingFace
   [Chat API] AI response received successfully
   ```

### Test 2: Check Timeout/Fallback Behavior (disconnect internet or use invalid key)
1. Open DevTools Network tab (slow down or disable internet)
2. Send a message
3. Should **not** show "Sending..." for more than 10 seconds
4. Should get offline fallback response with 💡 micro-suggestion
5. Console should show:
   ```
   [Chat API] Using offline fallback - AI service unavailable
   ```

### Test 3: Overall Request Timeout
1. If both Ollama and HuggingFace fail
2. Request should complete within 20 seconds maximum
3. User sees helpful offline message, not stuck "Sending..."

---

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Internet working, API responsive | ✓ Response in 10-25s | ✓ Response in 2-5s |
| Internet working, API slow | ✗ Stuck "Sending..." | ✓ Fallback + message in 10s |
| No internet/API down | ✗ Stuck "Sending..." (25s+) | ✓ Offline fallback in ~1s |
| User impatient | ✗ No way out | ✓ Can see fallback, understand what's happening |

---

## Configuration

**Current defaults:**
- Ollama timeout: Implicit (tries immediately, fails fast)
- HuggingFace timeout: **10 seconds**
- Total API request timeout: **20 seconds**
- HuggingFace model: **GPT2** (fast, reliable)
- Response length: **3-300 characters**

To adjust timeouts, edit [lib/ai.ts](lib/ai.ts):
```typescript
// Line ~135
const timeoutId = setTimeout(() => {
  console.warn('[HF API] Request timeout after 10s');
  controller.abort();
}, 10000); // Change 10000 to desired milliseconds
```

---

## Why This Works Now

1. **Fail Fast** - 10s timeout means we don't wait forever
2. **Reliable Fallback** - Offline micro-suggestions provide value even if API is down
3. **Better Visibility** - Logs show exactly what's happening
4. **Appropriate Model** - GPT2 is fast enough for sub-5s responses
5. **Safe Overall Limit** - 20s max ensures backend never hangs

---

## Still Having Issues?

### Check 1: Is HuggingFace API Key Valid?
```bash
# Check .env.local for HUGGINGFACE_API_KEY
# Visit https://huggingface.co/settings/tokens to verify/regenerate
```

### Check 2: Check Server Logs
```bash
npm run dev
# Then open browser console (F12) and chat
# Look for [Serene AI] and [HF API] logs
```

### Check 3: Test HuggingFace API Directly
```bash
curl -X POST \
  https://router.huggingface.co/models/gpt2 \
  -H "Authorization: Bearer YOUR_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs":"User: Hi\n\nSerene:"}'
```

If this times out, the HuggingFace API is down or your key is invalid.

---

## Next Steps

- Monitor logs to see if responses are coming from Ollama or HuggingFace
- If HuggingFace remains slow, consider using a faster model like `distilgpt2`
- If needed, implement response caching for common questions
