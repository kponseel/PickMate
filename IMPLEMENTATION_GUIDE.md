# PickMate Implementation Guide

## App Concept

**Single Owner + Shareable Voting Links**

1. **Owner** (authenticated user) creates decisions with options
2. **Owner** generates a shareable link for each decision
3. **Voters** (no login required) open the link and see a Tinder-like card swiper
4. **Voters** rate each option 1-3 stars, swipe right to continue, left to go back
5. **Owner** sees aggregated results from all voters

---

## User Flows

### Flow A: Owner Creates Decision
```
Login → Dashboard → Create Decision → Add Options → Get Shareable Link → Share
```

### Flow B: Voter Rates Options
```
Open Link → See First Option Card → Rate 1-3 Stars → Swipe Right → Next Card → ... → Done Screen
```

---

## Database Structure (Firestore)

```
decisions/
  {decisionId}/
    title: "Where should we eat?"
    category: "food"
    ownerId: "firebase-user-id"
    status: "active" | "completed"
    createdAt: timestamp

    options/ (subcollection)
      {optionId}/
        title: "Pizza Place"
        description: "Great pizzas"
        imageUrl: "https://..."
        price: "$25"
        url: "https://..."
        order: 1

    voters/ (subcollection)
      {uniqueVoterId}/
        name: "John" (optional)
        createdAt: timestamp
        completed: true/false

        ratings/ (subcollection)
          {optionId}/
            stars: 1-3
            ratedAt: timestamp
```

### Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Decisions: owner can read/write, anyone can read for voting
    match /decisions/{decisionId} {
      allow read: if true;  // Public read for shareable links
      allow write: if request.auth != null && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null;

      // Options: same as parent
      match /options/{optionId} {
        allow read: if true;
        allow write: if request.auth != null &&
          get(/databases/$(database)/documents/decisions/$(decisionId)).data.ownerId == request.auth.uid;
      }

      // Voters: anyone can create/update their own voter doc
      match /voters/{voterId} {
        allow read: if true;
        allow create: if true;
        allow update: if true;

        match /ratings/{optionId} {
          allow read, write: if true;
        }
      }
    }

    // User profiles (for owner info)
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Routes & Pages

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/` | LoginPage | Public | Owner login |
| `/dashboard` | DashboardPage | Owner only | List of owner's decisions |
| `/decision/new` | CreateDecisionPage | Owner only | Create decision + add options |
| `/decision/:id` | DecisionDetailPage | Owner only | View results, get share link |
| `/vote/:id` | VotingPage | Public | Tinder-like voting experience |
| `/vote/:id/done` | VoteDonePage | Public | Thank you screen |

---

## Components to Build

### 1. SwipeCard.jsx
```
- Full-screen card with option details
- Image, title, description, price
- Star rating (1-3) at bottom
- Swipe gestures (left/right)
- Visual feedback on swipe
```

### 2. CardStack.jsx
```
- Manages array of options
- Current card index
- Swipe handlers
- Progress indicator (3/10)
- Back button functionality
```

### 3. StarRatingInput.jsx
```
- Large touch-friendly stars
- Immediate visual feedback
- Required before proceeding
```

### 4. ShareLinkModal.jsx
```
- Display shareable URL
- Copy to clipboard button
- QR code (optional)
```

### 5. ResultsView.jsx (update)
```
- Show voter count
- Average rating per option
- Ranking with medals
- Voter breakdown (who voted what)
```

---

## Key Implementation Details

### Voter Identification
Since voters don't log in, use localStorage to create a unique voter ID:
```javascript
const getVoterId = () => {
  let id = localStorage.getItem('pickmate-voter-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('pickmate-voter-id', id)
  }
  return id
}
```

### Shareable Link Format
```
https://pickmate-123c1.web.app/vote/{decisionId}
```

### Swipe Implementation
Use a library like `react-tinder-card` or custom touch handlers:
```javascript
// Touch handling
onTouchStart → record startX
onTouchMove → calculate deltaX, apply transform
onTouchEnd → if deltaX > threshold, navigate
```

### Rating Storage
Store ratings immediately when user selects stars:
```javascript
await setDoc(
  doc(db, 'decisions', decisionId, 'voters', voterId, 'ratings', optionId),
  { stars, ratedAt: serverTimestamp() }
)
```

### Results Aggregation
Query all voters and their ratings:
```javascript
const votersSnap = await getDocs(collection(db, 'decisions', decisionId, 'voters'))
for (const voterDoc of votersSnap.docs) {
  const ratingsSnap = await getDocs(collection(voterDoc.ref, 'ratings'))
  // Aggregate...
}
```

---

## Files to Modify/Create

### New Files
- [ ] `src/pages/DashboardPage.jsx` - Owner's decision list
- [ ] `src/pages/CreateDecisionPage.jsx` - Create decision flow
- [ ] `src/pages/VotingPage.jsx` - Tinder-like voting
- [ ] `src/pages/VoteDonePage.jsx` - Thank you screen
- [ ] `src/components/SwipeCard.jsx` - Swipeable option card
- [ ] `src/components/CardStack.jsx` - Card stack manager
- [ ] `src/components/ShareLink.jsx` - Shareable link display

### Modify
- [ ] `src/App.jsx` - Update routes
- [ ] `src/pages/DecisionDetailPage.jsx` - Show results + share link
- [ ] `firestore.rules` - Update security rules

### Delete (no longer needed)
- [ ] `src/pages/CouplePage.jsx` - Couple pairing not needed
- [ ] `src/contexts/CoupleContext.jsx` - Remove couple logic

---

## Deployment Checklist

### 1. Firebase Console Setup
- [x] Create Firestore database
- [x] Enable Google authentication
- [ ] Update Firestore security rules (paste from above)
- [ ] Enable anonymous auth (optional, for voter tracking)

### 2. Local Testing
```bash
npm run dev
# Test owner flow: login, create decision, add options
# Test voter flow: open /vote/:id in incognito, rate options
```

### 3. Build & Deploy
```bash
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

### 4. GitHub Actions (automatic)
- Push to main branch triggers deployment
- Requires FIREBASE_SERVICE_ACCOUNT secret

---

## Testing Scenarios

1. **Owner creates decision with 5 options**
   - Login → Create → Add 5 options with images → Save

2. **Owner gets share link**
   - View decision → Copy link → Verify link format

3. **Voter completes voting**
   - Open link (incognito) → See first card → Rate → Swipe → Repeat → See done screen

4. **Voter goes back to change rating**
   - Swipe left → See previous card → Change rating → Continue

5. **Owner sees aggregated results**
   - View decision → See all ratings → See ranking

6. **Multiple voters**
   - Open link in different browsers → Vote → Owner sees combined results

---

## Estimated Structure After Implementation

```
src/
├── App.jsx
├── index.css
├── main.jsx
├── lib/
│   └── firebase.js
├── contexts/
│   └── AuthContext.jsx
├── components/
│   ├── Layout.jsx
│   ├── SwipeCard.jsx
│   ├── CardStack.jsx
│   ├── StarRatingInput.jsx
│   ├── ShareLink.jsx
│   ├── ResultsView.jsx
│   ├── Toast.jsx
│   └── BottomSheet.jsx
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── CreateDecisionPage.jsx
    ├── DecisionDetailPage.jsx
    ├── VotingPage.jsx
    └── VoteDonePage.jsx
```

---

## Ready to Implement?

Reply with "yes" to start implementation following this guide.
