# 🏙️ NagarMitra — Smart Civic Issue Reporting Platform

## 🙏 Credits

Based on the original NagarMitra project by Team ParaX (Aryan Rana, Prachi Khatri, Satakshi Roy, Diptanshu Vishwa): https://github.com/DiptanshuVishwa/NagarMitra

## 🔑 Demo accounts

Run `npm run seed:demo` in `nagarmitra-backend` (with `DEMO_PASSWORD` set in `.env`) to create a full India-wide set of demo accounts: one super admin, a master admin per state, an admin and five department officers per district, and a citizen per district. Logins are not published in this repository.

---

## ❗ Problem Statement

> **Domain: Green Infrastructure & Smart Cities**

India's urban local bodies face a silent crisis in civic governance:

1. 🚫 **No centralized platform** for citizens to report civic issues like potholes, drainage overflow, and sanitation failures
2. 📭 **Complaints go untracked and unresolved**, eroding trust in municipal governance
3. 📉 **Authorities lack data-driven tools** to organize and prioritize complaints efficiently
4. 🌊 **Unresolved issues** like waterlogging and waste mismanagement directly degrade green urban infrastructure
5. 🔄 **Absence of a citizen-government feedback loop** weakens participatory governance — a core Smart City requirement

---

## ✅ Our Solution — NagarMitra

**NagarMitra** (*Friend of the City*) is an AI-powered civic issue reporting platform that bridges the gap between citizens and urban local bodies. Citizens can report problems, track resolution, and engage with their community — all from one app.

```
Citizen spots issue → Uploads photo → AI auto-categorizes →
Complaint filed → Authority notified → Status tracked → Resolved ✅
```

---

## ✨ Key Features

### 📸 AI-Powered Issue Reporting (Google Gemini API)
- Upload a **photo** of any civic issue — pothole, garbage, broken streetlight, drain overflow
- **Google Gemini AI** auto-categorizes the issue, assigns priority, and routes it to the right department
- Zero manual effort — just click, submit, done

### 🤖 NagarMitra Chatbot (Botpress + ElevenLabs)
- Floating **💬 chat button** accessible on every screen of the app
- Understands **Hindi and English** — citizens can type in either language
- **🎤 Voice input supported** — speak your complaint instead of typing
- **ElevenLabs AI voice** — bot responds with natural AI voice synthesis
- Handles: complaint filing, status tracking, FAQs, and municipal service guidance

### 📱 Telegram Bot *(Live)*
- Full-featured Telegram bot for citizens who prefer messaging apps
- Send a **photo** → AI categorizes the issue automatically
- Register complaints, get tracking IDs, receive status updates
- Responds in **Hindi and English**
- Real-time notifications when complaint status changes
- **WhatsApp integration** — coming soon 🔜

### 🏘️ Community Page
- View and **upvote** civic issues reported in your ward
- See what neighbours have reported nearby
- Build community pressure on unresolved issues
- Share updates, comments, and resolution progress
- Full issue history per area

### 📊 Dashboard & Analytics
- Personal complaint tracking with real-time status
- Ward-level **heatmaps** to identify civic hotspots
- Stats: avg. response time, resolution rate, total reports
- Data-driven tools for authorities to prioritize work

### 🔔 Real-Time Notifications
- Push alerts at every stage: Filed → Acknowledged → In Progress → Resolved
- Ward-level alerts for new issues nearby

### 🗺️ GPS Location Tagging (Google Maps API)
- Auto-tag complaint location with GPS
- Heatmap visualization of issue hotspots across wards
- Location-based ward detection

### 🔐 Secure Authentication
- Firebase authentication (email + Google sign-in)
- JWT-based API security
- Remember me, onboarding flow, ward personalization

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React Native + Expo | Cross-platform mobile app (Android + iOS) |
| React Navigation | Tab & stack navigation |
| Firebase Auth | User authentication |
| react-native-webview | Botpress chat widget embedding |
| Expo AV | Audio/voice handling |
| AsyncStorage | Local data persistence |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express.js | REST API server |
| MongoDB Atlas | Cloud database |
| JWT | Secure session management |
| AWS S3 | Image & voice file storage |
| Firebase Admin | Push notifications |
| Telegram Bot API | Telegram bot integration |

### AI & Integrations
| Service | Purpose |
|---|---|
| Google Gemini API | Auto-categorization, priority assignment, smart routing |
| Botpress | Conversational AI chatbot engine |
| ElevenLabs | AI voice synthesis (text-to-speech) |
| Google Maps API | GPS tagging, heatmaps, location tracking |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CITIZEN LAYER                      │
│  📱 Mobile App  |  🤖 Chatbot  |  📱 Telegram Bot   │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   BACKEND API                        │
│         Node.js + Express + MongoDB Atlas            │
│    Auth | Complaints | Community | Analytics         │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  AI ENGINE   │ │   STORAGE    │ │ NOTIFICATION │
│ Gemini API   │ │   AWS S3     │ │   Firebase   │
│ Auto-classify│ │ Images/Voice │ │ Push Alerts  │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🗂️ Project Structure

```
NagarMitra_3/
├── nagarmitra-app/              # React Native mobile app
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.js
│   │   │   ├── DashboardScreen.js
│   │   │   ├── RaiseScreen.js        # AI-powered complaint filing
│   │   │   ├── CommunityScreen.js    # Ward community feed
│   │   │   ├── AuthScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   ├── FAQScreen.js
│   │   │   ├── NotificationsScreen.js
│   │   │   └── SettingsScreen.js
│   │   ├── components/
│   │   ├── api/
│   │   ├── lib/                      # Firebase config
│   │   └── services/
│   └── App.js                        # Root + Botpress floating chat
│
└── nagarmitra-backend/              # Node.js backend
    └── src/
        ├── routes/
        │   ├── complaints.js
        │   ├── community.js
        │   ├── media.js
        │   ├── users.js
        │   └── analytics.js
        ├── models/
        │   ├── User.js
        │   ├── Complaint.js
        │   ├── CommunityPost.js
        │   └── Notification.js
        ├── middleware/
        └── server.js               # Entry point + Telegram bot
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+, MongoDB Atlas account, Expo Go app, Firebase project

### 1. Clone the repo
```bash
git clone <your-repo-url>
cd NagarMitra_3
```

### 2. Setup Backend
```bash
cd nagarmitra-backend && npm install
```
Create `.env`:
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
AWS_S3_BUCKET=your_s3_bucket
```
```bash
npm run dev
```

### 3. Setup Mobile App
```bash
cd nagarmitra-app && npm install --legacy-peer-deps && npx expo start
```
Scan the QR code with **Expo Go** on your phone.

---

## 📱 App Screens

| Screen | Description |
|---|---|
| 🏠 Home | Stats, slideshow, raise complaint CTA, recent updates |
| 📊 Dashboard | Personal analytics, complaint history, heatmaps |
| ➕ Raise Complaint | Photo upload + Gemini AI auto-categorization |
| 👥 Community | Ward issue feed, upvotes, comments |
| 💬 Chatbot (floating) | Botpress + ElevenLabs voice bot on every screen |
| 🔔 Notifications | Real-time status push alerts |
| 👤 Profile | User info, ward details, complaint history |
| ❓ FAQ | Municipal service guidance |
| ⚙️ Settings | App preferences |

---

## 🌍 Multilingual Support

| Language | Status |
|---|---|
| 🇬🇧 English | ✅ Live |
| 🇮🇳 Hindi | ✅ Live |

## 🔮 Future Scope

- 📲 **WhatsApp Bot** integration *(Telegram is live, WhatsApp is next)*
- 🔁 **Duplicate complaint detection** using AI
- 🔮 **Predictive hotspot detection** — AI predicts issues before they worsen
- 🏛️ **Authority Web Portal** — dedicated dashboard for municipal officers
- 🌐 **Multi-city expansion** — fully scalable architecture from ward to state level

---

## 🏆 Impact & Real-World Application

| # | Impact |
|---|---|
| 01 | **Large Target Audience** — Urban citizens across municipalities facing daily civic issues |
| 02 | **Transparency Gap** — First platform for transparent, trackable civic complaint filing |
| 03 | **Digital Governance Growth** — Aligned with Smart City & Digital India initiatives |
| 04 | **Government Support** — Strong alignment with municipal modernization & e-governance policies |
| 05 | **Market Opportunity** — Scalable from ward-level to city-wide to state-wide implementations |

---

## 📞 Support & Contact

| Channel | Details |
| 💬 Chatbot | Available 24/7 in the app |
| 📱 Telegram | @NagarMitraBot |

---

