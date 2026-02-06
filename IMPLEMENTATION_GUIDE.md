# PickMate Implementation Guide

## App Concept - IMPLEMENTED ✅

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
        createdAt: timestamp
        completed: true/false

        ratings/ (subcollection)
          {optionId}/
            stars: 1-3
            ratedAt: timestamp
```

---

## Routes & Pages - IMPLEMENTED ✅

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/login` | LoginPage | Public | Owner login with Google |
| `/` | DashboardPage | Owner only | List of owner's decisions |
| `/decision/new` | CreateDecisionPage | Owner only | Create decision + add options |
| `/decision/:id` | DecisionDetailPage | Owner only | View results, get share link |
| `/vote/:id` | VotingPage | Public | Tinder-like voting experience |
| `/vote/:id/done` | VoteDonePage | Public | Thank you screen |
| `/profile` | ProfilePage | Owner only | User profile and logout |

---

## Components - IMPLEMENTED ✅

### VotingPage.jsx
- Full-screen Tinder-like card swiper
- Touch/swipe gestures for navigation
- Progress bar showing current position
- Star rating at bottom of each card
- Automatic save on rating
- Navigate back to change votes

### CreateDecisionPage.jsx
- Two-step form (details → options)
- Category selection with icons
- Add multiple options with details
- Image URL, price, link support

### DashboardPage.jsx
- List of owner's decisions
- FAB to create new decision
- Status badges (active/completed)
- Category icons

### DecisionDetailPage.jsx
- Share link with copy button
- Stats (votes received, options count)
- Results with progress bars
- Options list
- Complete/reopen actions

---

## Deployment Steps

### 1. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Hosting
```bash
npm run build
firebase deploy --only hosting
```

### Or via GitHub Actions (automatic)
Push to main branch triggers deployment via `.github/workflows/firebase-deploy.yml`

---

## Testing Scenarios

1. **Owner creates decision with 5 options**
   - Login → Create → Add 5 options with images → Save

2. **Owner gets share link**
   - View decision → Copy link → Verify link format

3. **Voter completes voting**
   - Open link (incognito) → See first card → Rate → Swipe → Repeat → See done screen

4. **Voter goes back to change rating**
   - Swipe left or tap back button → See previous card → Change rating → Continue

5. **Owner sees aggregated results**
   - View decision → See all ratings → See ranking

6. **Multiple voters**
   - Open link in different browsers → Vote → Owner sees combined results

---

## File Structure

```
src/
├── App.jsx                    # Routes configuration
├── firebase.js                # Firebase config
├── index.css                  # Styles with animations
├── main.jsx                   # Entry point
├── contexts/
│   └── AuthContext.jsx        # Authentication state
├── components/
│   ├── Layout.jsx             # App shell with nav
│   ├── BottomSheet.jsx        # Modal sheets
│   ├── Toast.jsx              # Notifications
│   ├── Skeleton.jsx           # Loading states
│   ├── StarRating.jsx         # Star rating input
│   ├── ProposalCard.jsx       # Option card (for results)
│   └── ResultsView.jsx        # Results display
└── pages/
    ├── LoginPage.jsx          # Google sign-in
    ├── DashboardPage.jsx      # Owner's decisions list
    ├── CreateDecisionPage.jsx # Create decision flow
    ├── DecisionDetailPage.jsx # View results + share
    ├── VotingPage.jsx         # Tinder-like voting
    ├── VoteDonePage.jsx       # Thank you screen
    └── ProfilePage.jsx        # User profile
```

---

## Shareable Link Format

```
https://pickmate-123c1.web.app/vote/{decisionId}
```

Example: `https://pickmate-123c1.web.app/vote/abc123def456`

---

## Voter Identification

Voters are identified by a random UUID stored in localStorage:
- Generated on first visit
- Persists across sessions
- Allows changing votes on return
