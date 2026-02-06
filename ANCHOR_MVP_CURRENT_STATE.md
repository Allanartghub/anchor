# Anchor MVP - Current State Summary
**Last Updated:** February 6, 2026  
**Version:** 0.1.0 (Pre-Launch MVP)

---

## Executive Summary

**Anchor** is a preventive mental load companion built exclusively for international postgraduate students in their first 12 months in Ireland. It tracks mental load across 7 fixed domains, provides structured weekly check-ins, supports ad-hoc load logging, and responds to patterns through AI-generated reflections.

**Current Status:** Feature-complete for core tracking flows. Ready for user testing and iterative refinement.

---

## Core Identity

### Target Audience (The Wedge)
- **Who:** International postgraduate students (Master's, PhD)
- **Where:** Ireland (any institution)
- **When:** First 12 months in-country
- **NOT for:** Undergraduates, domestic students, or students beyond year 1

### Product Philosophy
- **Preventive** (not reactive crisis intervention)
- **Non-clinical** (not therapy, counseling, or medical care)
- **Structured tracking** (7 fixed mental load domains)
- **Adult-to-adult tone** (calm, honest, no platitudes)
- **Privacy-first** (user owns data, can delete anytime)

### Anchor's Promise
> "Stay Steady - we help you spot patterns and lighten load before it becomes overwhelming."

---

## Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16.1.6 (Turbopack) | React-based full-stack app |
| **Language** | TypeScript 5.3 | Type-safe development |
| **Database** | Supabase (PostgreSQL) | User data, auth, RLS policies |
| **Authentication** | Supabase Auth | Magic link email login |
| **AI** | Hugging Face Inference API | Chat companion, pattern detection |
| **Styling** | Tailwind CSS 3.4 | Utility-first, custom calm palette |
| **Hosting** | Vercel (planned) | Serverless deployment |

---

## Core Features (Implemented)

### 1. Authentication & Onboarding ✅

**Login Flow**
- Magic link authentication (passwordless)
- Email-based, no password management
- Session persistence with Supabase

**Consent Flow**
- Privacy acknowledgement
- Clinical disclaimer (not therapy)
- Crisis resources (Ireland-specific)
- All three must be accepted to proceed

**Onboarding**
- Semester start timing capture (Early Jan, Late Jan, Early Sep, Late Sep)
- Current semester position (Start, Middle, End)
- Used for week-in-journey context and personalized prompts

### 2. Weekly Check-In (Primary Flow) ✅

**Multi-Step Structured Reflection (3-5 minutes)**

1. **Intro Screen** - Explains purpose, option to skip
2. **Domain Selection** - Choose top 1-2 load domains
3. **Intensity Rating** - Light / Moderate / Heavy (visual emoji scale)
4. **Reflection** - Guided prompt: "What felt heavier than expected this week?"
5. **Mood Snapshot (Optional)** - Quick emoji-based mood capture
6. **Summary** - Confirmation with optional chat entry point

**Behavior**
- Limited to **1 check-in per calendar week** (ISO week)
- Uses `upsert` to update existing check-in if user refines
- Prevents duplicate key violations on `(user_id, week_number, semester_year)`
- Saves to `weekly_checkin_responses` table
- Optional mood snapshot saves to `mood_entries` table

**Entry Points**
- Dashboard → "Start Check-In" card
- Large visual call-to-action (blue, priority positioning)

### 3. Ad-Hoc Load Tracking (Secondary Flow) ✅

**Unlimited Pressure Logging**

- **When:** Anytime between weekly check-ins or instead of
- **What:** Domain selection → Intensity → Reflection
- **Storage:** `load_entries` table with `load_domain_selections` junction
- **Never blocked** by weekly check-in completion

**Use Cases**
- Sudden financial pressure (bill arrives)
- Visa complication mid-week
- Academic deadline hits
- Social conflict emerges
- Health issue surfaces

**Entry Points**
- Dashboard → "Log Current Pressure" card
- Gray styling (secondary priority)

### 4. History Page (NEW - Responsive Load View) ✅

**Weekly Summary Architecture**

Groups all mental load data by ISO calendar week:
- 0 or 1 weekly check-in (primary signal)
- 0+ ad-hoc load entries (supporting signals)
- System-generated reflection (AI-ready, template-based for now)

**Each Week Card Displays:**
- Week number (e.g., "Week 5")
- Overall severity badge (Light/Moderate/Heavy with color coding)
- Dominant domain(s) with emojis (📚 Academic, 💰 Financial, etc.)
- 1-2 sentence reflection acknowledging load patterns
- Optional forward motion prompt (Heavy weeks only)
- Entry count indicator

**Expandable Detail View:**
- Click any week to expand
- Shows individual check-in entry (blue background)
- Shows all ad-hoc entries (gray background)
- Each entry includes: intensity badge, date, full reflection text
- Collapse to reduce visual clutter

**Reflection Tone Examples:**
- Light: "A lighter week overall, but you were present to what mattered."
- Moderate: "Academic load required attention this week. You tracked it clearly—that's the first step."
- Heavy (Financial): "Financial pressure put real pressure on you this week. This is serious and worth addressing."
- Heavy (Future): "Uncertainty about next steps weighed on you this week. That kind of load is real, even when it's not urgent."

**Philosophy: Respond to Load, Not Just Store It**
- Users feel seen, oriented in time, slightly steadier
- Avoids platitudes and generic reassurance
- Uses grounded, present tone for serious domains
- Forward motion is optional, not prescriptive

### 5. Mood Snapshots (Optional Feature) ✅

**Standalone Mood Logging**
- 6 mood options: Calm, Okay, Stressed, Low, Angry, Overwhelmed
- Emoji-based selection (😌, 🙂, 😰, 😔, 😠, 🌪️)
- Optional text note
- Daily or weekly frequency (user's choice)

**Integration Points**
1. **Standalone page** (`/mood`) - Quick capture anytime
2. **Within weekly check-in** - Optional step after reflection
3. **Timeline view** - Calendar/list/graph visualization

**Storage:** `mood_entries` table

**Purpose:** Lightweight emotional temperature check alongside load tracking

### 6. Structured Chat (Optional Feature) ✅

**AI Companion (Hugging Face Router)**

- Model: DeepSeek-V3.2 (via Novita router)
- System prompt: Calm, supportive, non-clinical mental load companion
- Context-aware: Knows which domain triggered chat

**Entry Points:**
- Post weekly check-in (if user wants to "talk it through")
- Post load entry (domain-specific chat)
- Dashboard card (optional access)

**Features:**
- Session management with message history
- Summary generation every 5 messages
- Risk detection for crisis keywords
- Ireland crisis resource linking (Samaritans, Pieta House, Aware)
- Session title auto-generation

**Storage:** `chat_sessions` and `chat_summaries` tables

**Fallback:** Offline micro-suggestions if API unavailable

### 7. Settings & Data Management ✅

**Account Settings**
- View email address
- Sign out

**Data Clearing (Granular)**
- Clear chat history
- Clear load entries
- Clear weekly check-ins
- Clear mood entries
- Each action requires confirmation

**Philosophy:** User owns their data, can delete anytime

---

## Database Schema (Complete)

### Core Tables

#### 1. `mental_load_domains` (Reference Table)
7 fixed domains (locked, not user-editable):
- `academic` - Academic Load 📚
- `financial` - Financial Load 💰
- `belonging` - Belonging & Social Load 🤝
- `administrative` - Administrative & Immigration Load 📋
- `worklife` - Work–Life & Time Load ⏰
- `health` - Health & Energy Load 💚
- `future` - Future & Stability Load 🎯

**Purpose:** Frames all user interactions, never customized

#### 2. `users_extended`
Extended user profile with journey context:
- `semester_start` (Early Jan, Late Jan, Early Sep, Late Sep)
- `semester_position` (Start, Middle, End)
- `cohort_code` (for institutional analytics)
- `metadata` (JSONB for future extensibility)

**Purpose:** Time-in-journey context for personalized prompts

#### 3. `load_entries`
Ad-hoc pressure logs:
- `intensity_label` (Light/Moderate/Heavy - user-facing)
- `intensity_numeric` (1-5 - system internal)
- `reflection_text` (guided prompt response)
- `week_number`, `semester_year` (for grouping)
- `has_risk_flag` (escalation marker)

**RLS:** Users only see their own entries

#### 4. `load_domain_selections`
Many-to-many linking (load entries ↔ domains):
- `load_entry_id` → `load_entries.id`
- `domain_id` → `mental_load_domains.id`
- `is_primary` (marks top domain)

**Purpose:** Multi-domain tracking per entry

#### 5. `weekly_checkin_responses`
Structured weekly reflections:
- `primary_domain_id`, `secondary_domain_id` (top 1-2 domains)
- `intensity_label`, `intensity_numeric` (dual scale)
- `structured_prompt` (question asked)
- `response_text` (user's answer)
- `suggested_action` (optional micro-suggestion)
- `completed_at` (timestamp)

**Unique Constraint:** `(user_id, week_number, semester_year)`
**RLS:** Users only see their own check-ins

#### 6. `mood_entries`
Optional mood snapshots:
- `mood_id` (calm, okay, stressed, low, angry, overwhelmed)
- `text` (optional note)
- `created_at` (timestamp)

**Purpose:** Lightweight emotional temperature check

#### 7. `chat_sessions`
AI chat conversation logs:
- `session_title` (auto-generated)
- `messages_json` (JSONB array of {role, content, timestamp})
- `summary_text` (generated every 5 messages)
- `domain_context` (which load domain triggered chat)
- `has_risk_flag` (crisis detection marker)

**RLS:** Users only see their own sessions

#### 8. `chat_summaries`
Persistent chat summary storage:
- `summary_text` (condensed conversation)
- `mood_at_time` (legacy field)
- `domain_context` (linked domain)
- `has_risk_flag` (escalation marker)

#### 9. `consent`
User consent record:
- `privacy_accepted_at`
- `disclaimer_accepted_at`
- `crisis_disclosure_accepted_at`
- `version` (consent version number)

**Critical:** All three timestamps required to access app

#### 10. `institutional_aggregates` (Placeholder)
Anonymized cohort analytics (no PII):
- `cohort_code`, `week_number`, `semester_year`, `domain_id`
- `avg_intensity_numeric`, `median_intensity_numeric`
- `sample_size`, `intensity_delta` (week-over-week change)

**Purpose:** Future institutional view for student services

---

## User Flows (End-to-End)

### Flow 1: New User Onboarding
```
1. Visit site (/) → Redirects to /login
2. Enter email → Magic link sent
3. Click link → Auth callback → /consent
4. Accept 3 consents → /onboarding
5. Enter semester context → /dashboard
```

### Flow 2: Weekly Check-In
```
Dashboard → "Start Check-In" button
  ↓
Intro → "Start Check-In" or "Skip"
  ↓
Select 1-2 domains (Academic, Financial, etc.)
  ↓
Choose intensity (Light/Moderate/Heavy)
  ↓
Write reflection (guided prompt)
  ↓
Optional: Select mood (6 emoji options)
  ↓
Summary → "Talk it through" (chat) or "Done" (dashboard)
```

**Result:** One row in `weekly_checkin_responses`, optional row in `mood_entries`

### Flow 3: Ad-Hoc Load Entry
```
Dashboard → "Log Current Pressure" button
  ↓
Select 1+ domains
  ↓
Choose intensity
  ↓
Write brief reflection
  ↓
Saved → Redirect to dashboard
```

**Result:** One row in `load_entries`, N rows in `load_domain_selections`

### Flow 4: Review History
```
Dashboard → "View Your Load History" button (or bottom nav)
  ↓
History page → Scrollable list of weeks (most recent first)
  ↓
Click any week → Expands to show:
  - Weekly check-in (if exists)
  - All ad-hoc entries for that week
  ↓
Click again → Collapses
```

**Result:** Understanding of patterns over time

### Flow 5: Mood Logging (Standalone)
```
Dashboard → "Log Mood" button
  ↓
Select mood emoji
  ↓
Optional: Add note
  ↓
Save → Redirect to timeline
```

**Result:** One row in `mood_entries`

### Flow 6: Optional Chat
```
After check-in or load entry → "Talk it through" button
  ↓
Chat interface with domain context
  ↓
Send message(s) → AI responds
  ↓
Every 5 messages → Auto-summary generated
  ↓
"Done" → Return to dashboard
```

**Result:** Session in `chat_sessions`, summaries in `chat_summaries`

---

## Navigation Structure

**Bottom Navigation (4 items)**
```
🧭 Home (Dashboard)  |  📊 History  |  😌 Mood  |  ⚙️ Settings
```

**Top-Level Pages**
- `/` - Root (redirects to /login or /dashboard)
- `/login` - Magic link authentication
- `/consent` - 3-part consent acceptance
- `/onboarding` - Semester context capture
- `/dashboard` - Main hub (entry points for all actions)
- `/checkin` - Weekly check-in flow
- `/load` - Ad-hoc load tracking
- `/mood` - Mood snapshot logging
- `/history` - Weekly load summaries
- `/timeline` - Mood history visualization
- `/chat` - AI companion (domain-triggered)
- `/settings` - Account management
- `/institutional` - Cohort analytics (admin placeholder)

---

## Entry Logging Rules (Clarified)

### ✅ What Users Can Do

1. **Unlimited ad-hoc load entries** - anytime, any week, never blocked
2. **One weekly check-in per calendar week** - system prevents duplicates
3. **Unlimited mood snapshots** - daily, weekly, or anytime
4. **Unlimited chat sessions** - optional, domain-linked

### ✅ How Data is Stored

- All entries logged **individually** in database
- No overwriting of previous entries
- Weekly summaries are **system-generated**, not user-entered
- Raw entries preserved forever (user can manually delete)

### ✅ Capture Freely → Structure Later

**Philosophy:** Don't restrict entry creation. Restrict how entries are grouped/summarized for clarity.

**Example:**
- Week 5: User logs 1 check-in + 3 ad-hoc entries = 4 total entries
- History page: Shows "Week 5" as one card (expanded shows all 4 individually)
- System: Generates one reflection acknowledging escalation ("With 3 separate entries logged, this week was heavier than usual")

---

## Design System

### Color Palette (Calm & Grounded)
```css
--calm-cream: #faf9f7;      /* Background */
--calm-blue: #e8f1f8;       /* Highlight (check-ins) */
--calm-sage: #e6f0e9;       /* Accent (crisis resources) */
--calm-teal: #d4e9e6;       /* Active nav */
--calm-text: #2c3e50;       /* Primary text */
--calm-border: #d4e3ed;     /* Borders */
```

### Intensity Color Coding
- **Light:** Green (`bg-green-50`, `border-green-200`, `text-green-700`)
- **Moderate:** Amber (`bg-amber-50`, `border-amber-200`, `text-amber-700`)
- **Heavy:** Red (`bg-red-50`, `border-red-200`, `text-red-700`)

### Typography
- Font: System font stack (Apple, Segoe UI, Roboto)
- Headings: Bold, 2xl-4xl
- Body: Regular, sm-base
- Labels: Semibold, xs-sm

### Tone & Voice
- **Preventive:** "Notice what's building before it overwhelms"
- **Non-clinical:** "Mental load," not "mental health"
- **Adult-to-adult:** No condescension or hand-holding
- **Calm:** Short sentences, no urgency unless crisis
- **Honest:** Name the load, don't sugar-coat

---

## Known Issues & Limitations

### 1. Domain Selection UI (Partial)
- **Issue:** Load entry saves to `load_entries` but `load_domain_selections` junction table not fully wired in UI
- **Workaround:** Primary domain stored in entry, multi-domain selection pending
- **Priority:** Medium (functional but not ideal)

### 2. LLM Reflection Generation (Template-Based)
- **Issue:** History page reflections are template-based, not LLM-generated
- **Status:** Infrastructure ready, API call pending
- **Next Step:** Wire `/api/generate-reflection` endpoint with Hugging Face
- **Priority:** Medium (templates are functional)

### 3. Institutional View (Placeholder)
- **Issue:** Page exists but has no admin role check or visualization
- **Status:** Data structure complete, UI stubbed
- **Next Step:** Add admin auth, build cohort dashboards
- **Priority:** Low (Phase 2 feature)

### 4. Risk Flag Escalation (Partial)
- **Issue:** Risk detection logic exists in chat, but no automated escalation workflow
- **Status:** Flags saved to database, UI shows crisis resources
- **Next Step:** Define escalation protocol (email alerts? institutional notification?)
- **Priority:** Medium (safety-critical)

### 5. Hydration Warning (Resolved)
- **Issue:** Browser extensions (Grammarly) add DOM attributes causing hydration mismatch
- **Fix:** Added `suppressHydrationWarning` to `<body>` tag
- **Status:** ✅ Fixed

### 6. Duplicate Check-In Error (Resolved)
- **Issue:** Users hitting unique constraint on `(user_id, week_number, semester_year)`
- **Fix:** Changed `insert` to `upsert` in weekly check-in flow
- **Status:** ✅ Fixed

---

## API Endpoints

### Public Routes
- `GET /auth/callback` - OAuth callback handler

### Protected Routes (Require Auth Token)
- `POST /api/chat` - Send message to AI companion
- `POST /api/chat/clear` - Delete all chat sessions
- `POST /api/load/clear` - Delete all load entries
- `POST /api/checkin/clear` - Delete all check-ins
- `POST /api/mood/clear` - Delete all mood entries

### Future Routes (Planned)
- `POST /api/generate-reflection` - LLM-generated weekly reflection
- `GET /api/institutional/aggregates` - Cohort analytics (admin-only)

---

## Environment Variables (Required)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Hugging Face (AI)
HF_TOKEN=YOUR_HUGGINGFACE_TOKEN
HUGGINGFACE_MODEL=deepseek-ai/DeepSeek-V3.2:novita
```

---

## Deployment Readiness

### ✅ Production-Ready
- All core user flows functional
- Database schema complete with RLS policies
- Error handling comprehensive
- Auth flow secure (magic links)
- Data privacy enforced (user isolation)

### ⚠️ Pre-Launch Checklist
- [ ] Test all flows with real user accounts
- [ ] Verify RLS policies block cross-user access
- [ ] Test multi-entry weeks (check-in + 3 ad-hoc)
- [ ] Verify History page reflections are accurate
- [ ] Test mood snapshot integration in check-in
- [ ] Confirm crisis resource links work (Irish numbers)
- [ ] Set up Vercel deployment pipeline
- [ ] Configure production environment variables
- [ ] Test magic link email delivery
- [ ] Verify chat AI responses are appropriate

### 🔜 Phase 2 Features (Post-Launch)
1. **LLM-Generated Reflections** - Replace templates with API calls
2. **Multi-Domain Selection UI** - Full junction table wiring
3. **Institutional View** - Admin dashboards for student services
4. **Pattern Detection** - Automated alerts for escalating load
5. **Micro-Suggestions** - Domain-specific actionable prompts
6. **Peer Matching** - Anonymous student connections
7. **Export Data** - Download CSV of all entries
8. **Mobile App** - iOS/Android native apps

---

## Success Metrics (Proposed)

### User Engagement
- Weekly check-in completion rate
- Ad-hoc entries per week (engagement depth)
- History page revisit rate
- Mood snapshot adoption (optional feature uptake)

### Load Tracking Efficacy
- Average domains selected per week
- Intensity distribution (Light/Moderate/Heavy trends)
- Multi-entry weeks (indicator of stress escalation)
- Time between entries (responsiveness)

### Retention & Satisfaction
- 30-day active user rate
- Average session duration
- User-initiated data deletion rate (inverse metric)
- Sentiment in chat messages (optional NLP analysis)

### Institutional Impact
- Cohort-level load trends
- Early intervention effectiveness (if escalation protocol added)
- Comparison across institutions (aggregated, anonymized)

---

## Team & Contact

**Project:** Anchor MVP  
**Target Launch:** Q1 2026  
**Built for:** International postgraduate students in Ireland  
**Tech Stack:** Next.js, Supabase, Hugging Face  

---

## Change Log

### v0.1.0 (Current - February 6, 2026)
- ✅ Core tracking flows (check-in, load, mood)
- ✅ History page with weekly summaries
- ✅ AI chat companion (Hugging Face)
- ✅ Navigation redesign (4-item nav)
- ✅ Bug fixes (duplicate check-in, hydration warning)
- ✅ Improved error handling throughout

### Upcoming
- Wire LLM reflection generation API
- Complete domain selection junction table UI
- Add institutional view with admin role check
- Define risk flag escalation protocol
- User testing and feedback iteration

---

**Status: Feature-complete MVP ready for testing and refinement.**

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with Supabase + HF credentials

# Run dev server
npm run dev

# Visit http://localhost:3000
```

**Test Accounts:** Use any email for magic link login (development mode)

---

**For detailed implementation notes, see:** `ANCHOR_OVERVIEW.md`  
**For database schema, see:** `ANCHOR_SUPABASE_SCHEMA.sql`
