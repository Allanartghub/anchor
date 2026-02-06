# Week 2: Chat Feature Implementation Guide

## Overview
Week 2 implements **Serene**, a conversational AI chatbot that provides calm, supportive responses to users. The chat feature includes:
- ✅ Ollama local AI integration (with HuggingFace fallback)
- ✅ Graceful degradation when AI unavailable (micro-suggestions fallback)
- ✅ Chat summaries storage (not full history)
- ✅ Risk flag detection for audit context
- ✅ Privacy disclosure and crisis resources
- ✅ Calm, judgment-free conversational interface

---

## Quick Start

### 1. Set Up Database
Run the SQL in [CHAT_SETUP.sql](CHAT_SETUP.sql) in your Supabase SQL Editor to create:
- `chat_summaries` table (stores conversation summaries, not full history)
- RLS policies ensuring users only see their own summaries

```bash
# Or paste the contents of CHAT_SETUP.sql directly into Supabase Dashboard > SQL Editor
```

### 2. Configure Environment Variables
Add to your `.env.local`:

```bash
# Ollama (local AI - FREE)
OLLAMA_URL=http://localhost:11434

# OR HuggingFace fallback (if not using Ollama)
HUGGINGFACE_API_KEY=your_hf_api_token_here
```

#### Option A: Use Ollama (Recommended for privacy/speed)
1. **Install Ollama**: Download from https://ollama.ai
2. **Pull a lightweight model**:
   ```bash
   ollama pull mistral
   # or: ollama pull neural-chat
   ```
3. **Start Ollama**:
   ```bash
   ollama serve
   # Runs on http://localhost:11434
   ```

#### Option B: Use HuggingFace (Fallback)
1. **Create account**: https://huggingface.co/
2. **Generate API token**: Settings > Access Tokens > New Token (read permission)
3. **Add to `.env.local`**:
   ```
   HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxx
   ```

### 3. Run the App
```bash
npm run dev
```

Visit `http://localhost:3000/chat` after logging in.

---

## Architecture

### Files Created

#### Backend
- **[lib/ai.ts](lib/ai.ts)** - AI service abstraction (Ollama → HuggingFace fallback)
- **[lib/microSuggestions.ts](lib/microSuggestions.ts)** - Mood-mapped offline suggestions
- **[app/api/chat/route.ts](app/api/chat/route.ts)** - Chat API endpoint
- **[lib/types.ts](lib/types.ts)** - Updated with ChatMessage, ChatSummary types

#### Frontend
- **[components/ChatInterface.tsx](components/ChatInterface.tsx)** - Full chat UI component
- **[app/chat/page.tsx](app/chat/page.tsx)** - Updated chat page

#### Database
- **[CHAT_SETUP.sql](CHAT_SETUP.sql)** - SQL migrations for Supabase

### Data Flow

```
User Message
    ↓
ChatInterface (React)
    ↓
POST /api/chat
    ↓
AI Service (/lib/ai.ts)
    ├→ Try Ollama (local)
    └→ Fallback: HuggingFace API
    ├→ If both fail: Micro-suggestions fallback
    ↓
Update Chat Summary (every 5 messages or risk flag)
    ↓
Return response + metadata
    ↓
Display in ChatInterface
```

### Key Features

#### 1. **Multi-tier AI Fallback**
```
Ollama (local, fastest, private)
  ↓ (if unavailable)
HuggingFace (slower, external, free tier limited)
  ↓ (if unavailable)
Micro-suggestions (prewritten, always works)
```

#### 2. **Summary Storage (Not Full History)**
- Every 5 user messages: Create/update daily summary
- On risk flag: Immediately flag for audit (without storing raw text)
- Stores: summary_text, mood_context, message_count, has_risk_flag
- **Does NOT store**: Full conversation history, individual messages

#### 3. **Graceful Degradation**
When AI unavailable:
```
User sees: "Serene is taking a break right now. Your check-in is saved. Try again in a bit."
+ 
Mood-mapped suggestion (e.g., if stressed: grounding technique)
```

#### 4. **Risk Detection**
Automatic detection of phrases like "kill myself", "suicide", "end my life", etc.
- Flags summary with `has_risk_flag: true`
- Still responsive to user (not alarming)
- Crisis resources included in chat UI

#### 5. **Privacy Disclosure**
- Built-in footer in ChatInterface shows:
  - "Not therapy or medical care"
  - Crisis resources (Irish numbers)
  - Data processing notice

---

## Configuration

### Serene System Prompt
Edit in [lib/ai.ts](lib/ai.ts):

```typescript
const SERENE_SYSTEM_PROMPT = `You are Serene, a calm and supportive wellness companion...`
```

Customize:
- Tone (warm, clinical, playful, etc.)
- Response length (currently 150 tokens max)
- Temperature (0.7 = balanced; 0.5 = focused; 1.0 = creative)

### Micro-Suggestions
Edit in [lib/microSuggestions.ts](lib/microSuggestions.ts):

```typescript
const SUGGESTIONS_BY_MOOD: Record<string, string[]> = {
  calm: ['...', '...'],
  okay: ['...', '...'],
  // etc
}
```

Add/modify suggestions by mood ID.

### Summary Trigger
Edit in [app/api/chat/route.ts](app/api/chat/route.ts):

```typescript
const shouldUpdateSummary =
  conversationState.message_count % 5 === 0  // ← Change 5 to another number
  || hasRiskFlag
  || isNewConversation;
```

---

## Testing

### Test Ollama Integration
```bash
# In terminal, with Ollama running:
curl http://localhost:11434/api/generate -X POST -d '{
  "model": "mistral",
  "prompt": "Hello, who are you?",
  "stream": false
}'
```

### Test Chat Endpoint
```bash
# Login first, then:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I feel stressed","moodContext":"stressed"}'
```

### Test Fallback
1. Stop Ollama: `killall ollama` or stop the service
2. Remove HUGGINGFACE_API_KEY from `.env.local`
3. Chat should show micro-suggestions + "Serene is taking a break"

### Test Risk Detection
Send message like "I want to hurt myself"
- Should trigger `has_risk_flag: true` in API response
- Should append crisis resources to chat

---

## Deployment Notes

### For Production
1. **Use HuggingFace or paid API**: Ollama on localhost won't work in cloud
2. **Add rate limiting**: Protect `/api/chat` from spam
3. **Audit logging**: Log all risk flags and who triggered them
4. **GDPR compliance**: Add data retention policy for summaries
5. **Session timeout**: Consider auto-logout after X minutes of inactivity
6. **Monitoring**: Alert on AI service failures, response times

### Environment Variables (Production)
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Pick ONE AI provider:
OLLAMA_URL=https://your-ollama-instance.com  # Self-hosted
HUGGINGFACE_API_KEY=hf_xxx                   # HuggingFace paid tier
# Or other providers (OpenAI, Claude, etc.) - requires code changes to lib/ai.ts
```

---

## Known Limitations (MVP)

1. **Conversation state is session-only** - Resets on page reload
   - Fix: Store in Supabase `conversation_state` table
   
2. **Full conversation history not stored** - By design (summaries only)
   - Users can't scroll back through old chats
   - Fix: Add optional "View conversation history" with pagination

3. **No user editing of chat** - Can't delete/edit past messages

4. **No multi-turn context** - Each message treated somewhat independently
   - Could improve by building full context from summary

5. **Ollama requires local installation** - Not suitable for shared/cloud deployments
   - Fix: Use cloud-based API provider (HuggingFace, OpenAI, etc.)

---

## Next Steps (Future Weeks)

- [ ] **Analytics/Insights**: Mood trend visualization
- [ ] **Chat History**: Persistent conversation storage (if needed)
- [ ] **AI Customization**: Let users choose Serene's personality
- [ ] **Paid AI Upgrade**: Switch to Claude/GPT-4 with user consent
- [ ] **Conversation export**: Let users export chats as PDF
- [ ] **Reminder notifications**: "How are you feeling?" prompts
- [ ] **Integration with mood data**: Better context from recent mood entries

---

## Troubleshooting

### "Serene is taking a break" message appears
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Check HuggingFace API key is valid
- Check network/firewall isn't blocking requests

### Chat API returns 401
- User not authenticated. Ensure session is valid
- Check `/consent` page - user might not have consented

### Long response times
- Ollama model is large or slow. Try `neural-chat` instead of `mistral`
- HuggingFace free tier has rate limits - wait and retry

### Summary not updating
- Check Supabase table has RLS disabled or policies correct
- Check user_id is being passed correctly
- Check console logs for errors

---

## Safety & Compliance

✅ **What's Implemented:**
- Crisis resources always visible
- No storing full conversation (privacy-preserving)
- Risk flag detection (audit trail)
- Session-only (minimal data retention)
- RLS on summaries table

⚠️ **What to Add Later:**
- GDPR data export/deletion
- Audit logs with timestamps
- Rate limiting per user
- Session timeout policy
- Explicit consent for external AI usage

---

## References

- **Ollama**: https://ollama.ai
- **HuggingFace Inference API**: https://huggingface.co/inference-api
- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
