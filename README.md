# Iris

An AI-powered email-to-task pipeline with a native macOS menu bar app. It reads your inbox, extracts actionable events using Gemini AI, and displays them in a sleek, priority-colored interface — right from your menu bar.

---

## Architecture

```
┌────────────────────┐        ┌──────────────────┐        ┌───────────────┐
│  Google Apps Script │──POST──▶  Node.js Backend  │──save──▶   MongoDB     │
│  (Gmail Webhook)   │        │  (Express + AI)   │        │              │
└────────────────────┘        └──────────────────┘        └───────────────┘
                                       ▲
                                       │ HTTP
                              ┌────────┴────────┐
                              │  Electron App    │
                              │  (macOS Menubar) │
                              └─────────────────┘
```

**Flow:**
1. Google Apps Script fetches emails from Gmail and POSTs raw email data to the backend webhook.
2. Backend pipes the emails through **Gemini AI** to extract structured events (title, date, priority, type).
3. Events are deduplicated via SHA-256 hashing and stored in MongoDB.
4. The Electron menu bar app fetches and displays events with real-time search, priority coloring, and manual completion.

---

## Features

- **AI Extraction** — Gemini 2.5 Flash parses unstructured emails into structured task events
- **Smart Deduplication** — SHA-256 hashing prevents duplicate entries on re-processing
- **Priority System** — `ultra-high`, `high`, `medium`, `low` with color-coded cards
- **Cross-field Search** — Search across title, description, event type, status, priority, and sender
- **Tabbed Views** — Upcoming, Past, All, and Trash tabs
- **UI-only Trash** — Dismiss events from view without deleting from DB; restore anytime
- **Manual Completion** — Mark events as completed with a single click (synced to DB)
- **Fetch on Demand** — Trigger email ingestion from the menu bar via Google Apps Script
- **Native macOS App** — Packaged as a `.app` with custom icon, right-click to quit

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini 2.5 Flash |
| Database | MongoDB (Mongoose) |
| Email Ingestion | Google Apps Script (Webhook) |
| Menu Bar App | Electron + Menubar |
| Packaging | electron-packager |

---

## Project Structure

```
Iris/
├── backend/
│   └── src/
│       ├── api/
│       │   └── eventRouter.ts          # REST routes
│       ├── controller/
│       │   └── eventController.ts      # Request handlers
│       ├── service/
│       │   ├── aiService.ts            # Gemini AI extraction
│       │   ├── eventService.ts         # DB operations & search
│       │   ├── pipelineService.ts      # Email → AI → DB pipeline
│       │   ├── hashingService.ts       # SHA-256 deduplication
│       │   └── mailService.ts          # IMAP fetcher (legacy)
│       ├── model/
│       │   └── eventsSchema.ts         # Mongoose schema
│       ├── db/
│       │   └── db.ts                   # MongoDB connection
│       ├── config.ts                   # Environment config
│       └── index.ts                    # Express server entry
├── menubar/
│   ├── main.js                         # Electron main process
│   ├── renderer.js                     # Frontend logic
│   ├── index.html                      # UI structure
│   ├── styles.css                      # Dark glassmorphism theme
│   └── assets/
│       ├── iconTemplate.png            # Menu bar tray icon
│       ├── icon.icns                   # macOS .app icon
│       └── source.png                  # Source icon image
└── README.md
```

---

## Setup

### Prerequisites

- Node.js (v18+)
- MongoDB running locally (`mongodb://127.0.0.1:27017`)
- Google Gemini API key
- A Gmail account with Google Apps Script access

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/mail_schedule
GEMINI_API_KEY=your_gemini_api_key
PORT=9001
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Build and run:

```bash
npm run build
npm start
```

### 2. Google Apps Script

Create a new Apps Script project at [script.google.com](https://script.google.com) and paste:

```javascript
function doGet(e) {
  forwardEmailsToBackend();
  return ContentService.createTextOutput("Emails processed.");
}

function forwardEmailsToBackend() {
  var threads = GmailApp.search('in:inbox', 0, 25);
  var emailsData = [];
  
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var latestMessage = messages[messages.length - 1]; 
    
    emailsData.push({
      from: latestMessage.getFrom(),
      subject: latestMessage.getSubject(),
      date: latestMessage.getDate().toISOString(),
      body: latestMessage.getPlainBody() || ""
    });
    
    threads[i].markRead();
  }
  
  if (emailsData.length === 0) return;
  
  var backendUrl = "YOUR_BACKEND_URL/event/webhook"; 
  
  UrlFetchApp.fetch(backendUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(emailsData)
  });
}
```

**Deploy as Web App:**
1. Click **Deploy → New Deployment → Web App**
2. Execute as: **Me** | Access: **Anyone**
3. Copy the URL into your `.env` as `GOOGLE_SCRIPT_URL`

**Set up daily trigger:**
1. In Apps Script, go to **Triggers** (clock icon)
2. Add trigger → `forwardEmailsToBackend` → Time-driven → Day timer → Midnight

### 3. Menu Bar App

```bash
cd menubar
npm install
```

**Run in dev mode:**
```bash
npm start
```

**Build as native .app:**
```bash
npm run build-mac
```

The built app will be at `release-builds/Iris-darwin-arm64/Iris.app`. Copy it to `/Applications` to use it system-wide.

---

## API Endpoints

All routes are prefixed with `/event`.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/upcoming` | Get all future events |
| `GET` | `/past/:days` | Get events from the last N days |
| `GET` | `/all` | Get all events (upcoming + past) |
| `GET` | `/search?q=term` | Search across all event fields |
| `GET` | `/byDate/:date` | Get events for a specific date |
| `GET` | `/load` | Trigger Google Apps Script to fetch new emails |
| `POST` | `/webhook` | Receive email data from Google Apps Script |
| `PUT` | `/update/:eventId` | Update an event (e.g., mark as completed) |
| `PUT` | `/remove/:eventId` | Soft-delete an event (sets `isActive: false`) |

---

## Event Schema

```typescript
{
  title: string;                    // "DSA Assignment Submission"
  description: string;              // "Submit via LMS by midnight"
  eventType: "ASSIGNMENT" | "EVENT" | "INTERVIEW" | "EXAM" | "MEETING" | "OTHER";
  date: Date;                       // 2026-04-20
  time: string;                     // "23:59" or "00:00" for all-day
  eventStatus: "pending" | "missed" | "cancelled" | "completed" | "rescheduled";
  priority: "ultra-high" | "high" | "medium" | "low";
  senderEmail: string;              // "professor@university.edu"
  eventHash: string;                // SHA-256 for deduplication
  isActive: boolean;                // Soft-delete flag
}
```

---

## License

MIT
