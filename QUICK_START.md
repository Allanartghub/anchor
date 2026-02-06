# Week 2 Quick Start Guide

**TL;DR**: Set up database + AI, run app, test chat feature.

---

## 1️⃣ Database Setup (5 minutes)

### Step 1: Open Supabase Dashboard
- Go to https://app.supabase.com
- Select your Anchor project
- Click **SQL Editor** (left sidebar)

### Step 2: Create Chat Tables
- Click **"New Query"**
- Copy-paste entire contents of [CHAT_SETUP.sql](CHAT_SETUP.sql)
- Click **"Run"**
- Should complete without errors ✅

---

## 2️⃣ Configure AI (Choose One)

### Option A: Ollama (LOCAL - Recommended)
**Time: 10 minutes | Privacy: Maximum | Cost: Free**

```bash
# 1. Download Ollama
# Visit https://ollama.ai → Download for your OS

# 2. Install and open Ollama

# 3. Open terminal and pull a model
ollama pull mistral
# Wait for download (2GB)

# 4. Start server (keep terminal open)
ollama serve
# Should show: Listening on 127.0.0.1:11434

# 5. Verify it works (new terminal)
curl http://localhost:11434/api/tags
# Should return JSON list of models
```

**That's it** - Anchor will auto-detect Ollama at `http://localhost:11434`

### Option B: HuggingFace (CLOUD - Fallback)
**Time: 5 minutes | Privacy: Medium | Cost: Free tier (limited)**

```bash
# 1. Create account
# Visit https://huggingface.co/join

# 2. Generate API token
# Settings (top right) > Access Tokens > New Token
# Name: "anchor"
# Type: "Read"
# Copy the token

# 3. Add to .env.local
# Edit .env.local in your project root:
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxx
# Paste your token after "hf_"

# 4. Restart dev server
npm run dev
```

---

## 3️⃣ Run the App

```bash
# Terminal 1: Start dev server
cd e:\anchor
npm run dev

# Should show:
# ▲ Next.js 16.1.6
# - ready started server on 0.0.0.0:3000
```

---

## 4️⃣ Test Chat Feature

1. Open browser: `http://localhost:3000`
2. Log in with your test account
3. Accept consent screens (if first time)
4. Click **"Chat"** in navigation
5. Type message: _"Hello Serene"_
6. Click **Send**
7. **Wait 3-10 seconds**
8. Serene responds! ✅

---

## 5️⃣ Verify It's Working

### Check 1: Response Arrives
- [✔️] User message appears on right (blue)
- [✔️] Serene response appears on left (white)
- [✔️] Both have timestamps
- [✔️] No console errors

### Check 2: Data Saved
- Open Supabase Dashboard
- Go to **Table Editor**
- Click **chat_summaries**
- After 5+ messages, should see one row:
  - `user_id`: Your user ID
  - `message_count`: Should be 5+
  - `has_risk_flag`: false

### Check 3: Fallback Works
- Stop Ollama: `killall ollama` (or close Ollama app)
- Send another message
- Should see: _"Serene is taking a break right now..."_
- Followed by a suggestion (e.g., for stressed mood: grounding technique)

---

## 🎯 Full Testing

For comprehensive testing (20 test scenarios), see:
→ [WEEK2_TESTING_CHECKLIST.md](WEEK2_TESTING_CHECKLIST.md)

---

## 🚨 Troubleshooting

### "Serene is taking a break" immediately after message
- **Ollama not running?**
  - Check: Is terminal with `ollama serve` still open?
  - Restart: `ollama serve`
  
- **HuggingFace API key invalid?**
  - Check: Is `HUGGINGFACE_API_KEY` in `.env.local`?
  - Check: Does it start with `hf_`?
  - Refresh token: https://huggingface.co/settings/tokens
  
- **Both unavailable?**
  - Should still show offline suggestion
  - Check console (F12 > Console) for errors

### Long response time (>15 seconds)
- **Ollama model might be slow**
  - Try: `ollama pull neural-chat` (lighter model)
  - Or: `ollama pull openchat`
  - Then: Change system prompt to use that model (in lib/ai.ts)

- **First message is slow**
  - Normal - model loading for first time
  - Subsequent messages should be faster

### Messages not saving to Supabase
- **Check database table exists**
  - Supabase > Table Editor > scroll down
  - Should see `chat_summaries` table
  - If not, re-run CHAT_SETUP.sql

- **Check RLS policies**
  - Table Editor > chat_summaries > RLS
  - Should see 4 policies (SELECT, INSERT, UPDATE, DELETE)

### User can't access Chat
- **User not logged in?**
  - Go to Login page, log in again
  
- **User didn't accept consents?**
  - Should redirect to Consent page first
  - Accept all 3 sections
  
- **Session expired?**
  - Log out and log back in

---

## 📋 What's Included

✅ **Serene Chatbot** - Conversational AI responses  
✅ **Ollama Integration** - Local, private AI (Mistral model)  
✅ **HuggingFace Fallback** - Cloud-based backup AI  
✅ **Offline Suggestions** - When AI unavailable  
✅ **Chat Summaries** - Privacy-first storage (not full history)  
✅ **Risk Detection** - Flags crisis phrases  
✅ **Mood Context** - Serene knows user's current mood  
✅ **Privacy Disclosure** - Footer with crisis resources  

---

## 📝 Next Steps

After testing:
1. Provide feedback on chat responses
2. Test with different moods
3. Try triggering fallback (stop Ollama)
4. Review [WEEK2_SUMMARY.md](WEEK2_SUMMARY.md) for full details

---

## 💡 Pro Tips

- **Mood context**: Complete a mood check-in before chatting - Serene will know your mood
- **Session-only**: Chat resets on page reload (by design - MVP behavior)
- **Summaries only**: Full conversation not stored (privacy-first)
- **Crisis resources**: Footer always visible at bottom of chat
- **Shift+Enter**: Use for multi-line messages

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| [CHAT_SETUP.sql](CHAT_SETUP.sql) | Database migrations | Run first |
| [lib/ai.ts](lib/ai.ts) | AI service + fallback logic | Ready |
| [lib/microSuggestions.ts](lib/microSuggestions.ts) | Offline suggestions | Ready |
| [app/api/chat/route.ts](app/api/chat/route.ts) | Chat API endpoint | Ready |
| [components/ChatInterface.tsx](components/ChatInterface.tsx) | Chat UI | Ready |
| [app/chat/page.tsx](app/chat/page.tsx) | Chat page | Ready |
| [WEEK2_CHAT_SETUP.md](WEEK2_CHAT_SETUP.md) | Detailed setup guide | Reference |
| [WEEK2_TESTING_CHECKLIST.md](WEEK2_TESTING_CHECKLIST.md) | Full test suite | Optional |
| [WEEK2_SUMMARY.md](WEEK2_SUMMARY.md) | Implementation details | Reference |

---

**Ready to go!** Follow steps 1-4 above and you'll have a working chat feature in ~30 minutes.

Need help? Check [WEEK2_CHAT_SETUP.md](WEEK2_CHAT_SETUP.md) for detailed explanations.
