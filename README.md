# PickMate

A mobile-first PWA for couples to make decisions together — propose options, rate them, and pick a winner.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    PWA Shell                         │
│  (installable, offline-capable, portrait-oriented)   │
├─────────────────────────────────────────────────────┤
│            React SPA (Vite + React Router)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Login   │ │Decisions │ │  Couple  │ │Profile │ │
│  │  Page    │ │  Page    │ │  Page    │ │ Page   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│            ↕ Context Providers (Auth, Couple)        │
│            ↕ Custom Hooks (decisions, proposals,     │
│              ratings) — real-time Firestore listeners │
├─────────────────────────────────────────────────────┤
│               Firebase Backend                       │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────┐ │
│  │    Auth    │ │ Firestore  │ │    Hosting      │ │
│  │ Email,    │ │ Real-time  │ │ CDN + SSL       │ │
│  │ Google,   │ │ Database   │ │ SPA rewrites    │ │
│  │ Apple     │ │            │ │                 │ │
│  └────────────┘ └────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Why this stack?

| Choice | Rationale |
|--------|-----------|
| **React + Vite** | Fast builds, large ecosystem, simple mental model |
| **Tailwind CSS** | Utility-first — no separate CSS files, consistent design |
| **Firebase Auth** | Zero-backend auth with email, Google, and Apple sign-in |
| **Firestore** | Real-time sync between both partners, zero server code |
| **Firebase Hosting** | Free tier, global CDN, automatic SSL, SPA support |
| **vite-plugin-pwa** | Auto-generates service worker and manifest for installability |

## Firestore Data Model

```
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── coupleId: string | null
  └── createdAt: ISO string

couples/{coupleId}
  ├── members: string[]          (1-2 user IDs)
  ├── inviteCode: string         (6-char uppercase code)
  ├── createdBy: string
  └── createdAt: ISO string

decisions/{decisionId}
  ├── coupleId: string           (FK to couples)
  ├── title: string
  ├── category: string           (travel|food|shopping|activity|movie|other)
  ├── status: string             (open|closed|archived)
  └── createdAt: ISO string

proposals/{proposalId}
  ├── decisionId: string         (FK to decisions)
  ├── title: string
  ├── description: string
  ├── url: string                (external link)
  ├── imageUrl: string
  ├── price: string
  └── createdAt: ISO string

ratings/{decisionId_proposalId_userId}
  ├── decisionId: string
  ├── proposalId: string
  ├── userId: string
  ├── stars: number              (1, 2, or 3)
  └── updatedAt: ISO string
```

### Key design decisions:

- **Flat collections** (not subcollections) — simpler queries and security rules
- **Deterministic rating IDs** (`decision_proposal_user`) — enforces one vote per user per proposal without needing a unique constraint
- **Invite codes** — 6-char random codes for couple pairing; no complex link/email invitation needed for MVP
- **ISO date strings** — portable, human-readable, sortable

## Business Logic

### Rating system
- Each user rates each proposal from 1 to 3 stars
- One rating per user per proposal (upserted via deterministic doc ID)
- Results ranked by total stars (sum), with average shown

### Decision lifecycle
```
  open → closed → archived
    ↑       │
    └───────┘  (can reopen)
```
- **Open**: proposals can be added/removed, ratings can be changed
- **Closed**: voting locked, results are final
- **Archived**: hidden from main view (future enhancement)

### Permissions
- Only couple members can see their decisions
- Either partner can create/rate/close decisions
- Leaving a couple cleans up the association

## Frontend Structure

```
src/
├── main.jsx                 # Entry point
├── App.jsx                  # Router + providers
├── index.css                # Tailwind imports + theme
├── firebase.js              # Firebase initialization
├── contexts/
│   ├── AuthContext.jsx       # Auth state + methods
│   └── CoupleContext.jsx     # Couple state + methods
├── hooks/
│   ├── useDecisions.js       # CRUD + real-time decisions
│   ├── useProposals.js       # CRUD + real-time proposals
│   └── useRatings.js         # Rating + result calculation
├── components/
│   ├── Layout.jsx            # Shell with header + bottom nav
│   ├── StarRating.jsx        # 1-3 star input/display
│   ├── ProposalCard.jsx      # Proposal with rating
│   └── ResultsView.jsx       # Ranked results display
└── pages/
    ├── LoginPage.jsx         # Auth (email/Google/Apple)
    ├── DecisionsPage.jsx     # Decision list + creation
    ├── DecisionDetailPage.jsx # Proposals + ratings + results
    ├── CouplePage.jsx        # Create/join/manage couple
    └── ProfilePage.jsx       # User info + logout
```

## State Management Strategy

No external state library needed. The app uses:

1. **React Context** for global state (auth user, couple info)
2. **Custom hooks with Firestore `onSnapshot`** for real-time data (decisions, proposals, ratings)
3. **Local component state** for UI interactions (forms, tabs)

Data flows: Firebase → `onSnapshot` listeners → React state → UI. Writes go directly to Firestore, and the snapshot listeners automatically update the UI.

## Security Rules

See `firestore.rules` for the complete ruleset. Key principles:

- Users can only read/write their own user document
- Couple documents are readable only by their members
- Decisions are scoped to the couple that created them
- Ratings enforce `stars` between 1-3 and `userId` matches the authenticated user
- No user can delete their profile document (data retention)

## Firebase Deployment Guide

### Step 1: Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project**, name it (e.g., `pickmate`)
3. Disable Google Analytics (not needed for MVP)
4. Click **Create project**

### Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication > Sign-in method**
2. Enable **Email/Password**
3. Enable **Google** (select a support email)
4. (Optional) Enable **Apple** — requires an Apple Developer account

### Step 3: Create Firestore Database

1. Go to **Firestore Database > Create database**
2. Select **Start in production mode**
3. Choose a region close to your users (e.g., `europe-west1` for EU/GDPR)
4. After creation, go to **Rules** tab and paste the contents of `firestore.rules`

### Step 4: Register your web app

1. Go to **Project Settings > General**
2. Under "Your apps", click the web icon (`</>`)
3. Register app name: `PickMate`
4. Copy the `firebaseConfig` values

### Step 5: Configure environment

```bash
cp .env.example .env
# Edit .env with your Firebase config values from Step 4
```

### Step 6: Install Firebase CLI and deploy

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize (select Hosting and Firestore when prompted)
firebase init

# Build the app
npm run build

# Deploy
firebase deploy
```

### Step 7: Set up GDPR-compliant data location

Firestore region should be `europe-west1` (Belgium) or another EU region. Firebase Auth data processing follows Google's [Data Processing Terms](https://firebase.google.com/terms/data-processing-terms).

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file and add your Firebase config
cp .env.example .env

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

## PWA Installation

- **Android**: Open in Chrome → tap "Add to Home Screen" in the browser menu
- **iOS**: Open in Safari → tap Share → "Add to Home Screen"

The app works offline for cached pages and syncs when connectivity returns (Firestore handles this automatically).
