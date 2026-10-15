# Tactica Scout Mobile 📱⚡

A native mobile client for Tactica Scout built with **React Native** and **Expo Go**, delivering a single codebase for both iOS and Android with full feature parity to the web application.

---

## 🌟 Feature Overview (100% Web Parity)

1. **Top Tactical Header (Universal on all screens)**:
   - **SCOUT Brand & Volt Status** on the far left.
   - **Tactical Search Bar** dead-center: Opens the search modal to look up clubs and players with live search results.
   - **Profile & Settings Icon** on the far right: Opens account settings, followed clubs list, language selector, and backend server URL settings.

2. **Matches (Tab 1)**:
   - Day-by-day date navigation (`<`, `>`, date badge, "Today" shortcut).
   - Filter chips: `All`, `Live (count)`, `Upcoming`, `Finished`, `Following`.
   - Live pulse indicator and minute ticker.
   - Matches grouped by competition/league with kickoff times, scores, and club badges.

3. **Tactical Compare (Tab 2)**:
   - Side-by-side player search and comparison.
   - Dual-overlaid SVG Tactical Radar Chart (Player 1 in Volt `#d4ff00`, Player 2 in Sky Blue `#38bdf8`).
   - Direct opposing attribute bar graphs (Shooting, Passing, Dribbling, Defending, Creativity, Physical).

4. **Competitions & Leagues (Tab 3)**:
   - Horizontal league selection pills (Premier League, La Liga, Serie A, Bundesliga, etc.).
   - **Standings Table**: Full tables with UCL, UEL, UECL, and Relegation color-coded left strips.
   - **Fixtures**: Scheduled and upcoming league matches.
   - **Top Leaders**: Top Goalscorers and Top Playmakers leaderboards with ranks, photos, and club links.

5. **News (Tab 4)**:
   - Curated tactical analysis and briefs from Medium and X (Twitter).
   - In-app external link launcher to read full articles.

6. **Match Breakdown (`/match/[id]`)**:
   - Live scoreboard hero with venue, competition, and live minute indicator.
   - 5 Breakdown tabs:
     - **Overview**: Goalscorers, last 5 results team form strip (`W`, `D`, `L`), key incidents timeline.
     - **Lineups**: Formations, starters, and substitutes with shirt numbers and positions.
     - **Stats**: Total shots, shots on target, possession, corners, cards.
     - **H2H**: Historic summary and recent meetings.
     - **Facts**: Tactica Data Engine attack/defense indexes and algorithmic win probabilities.

7. **Club Profile (`/team/[id]`)**:
   - Hero header with club badge, country, stadium capacity, and primary league & table position badge.
   - Star `Follow` / `Following` toggle button.
   - 4 Tabs:
     - **Overview**: Manager tactical profile (possession %, goals scored/conceded), upcoming fixtures.
     - **Matches**: Full team fixture calendar.
     - **Squad**: Full player roster with positions and numbers.
     - **Table**: Dedicated league standings table with the team dynamically highlighted in volt!

8. **Player Profile (`/player/[id]`)**:
   - Player photo, position, rating index pill, nationality, and current club link.
   - Physical bio grid (Height, Weight, Preferred Foot, Market Value).
   - Full 6-axis SVG Radar chart and attribute breakdown.
   - One-tap "Compare" shortcut.

---

## 🚀 Running with Expo Go (Single Build for iOS & Android)

### 1. Install Dependencies
```bash
cd scout-mobile
npm install
```

### 2. Start the Expo Dev Server
```bash
npx expo start
```

### 3. Open on your Phone
- **iOS**: Open the standard iOS **Camera app** and scan the QR code displayed in your terminal. It will open in **Expo Go**.
- **Android**: Open the **Expo Go app** from the Google Play Store and scan the QR code.

---

## 🌐 Connecting to the Backend

### Option A: Hosted on Render (Recommended)
You can deploy `scout-backend` directly to Render for free using the included `scout-backend/render.yaml` configuration!

1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), create a new **Web Service** pointing to the `scout-backend` directory (or use Blueprints with `render.yaml`).
3. Set your `BSD_API_KEY` environment variable in Render.
4. Once deployed, open **Profile & Settings** in the mobile app (top right icon), paste your Render URL (e.g. `https://tactica-scout-api.onrender.com`), and tap **Save & Test URL**.

### Option B: Local PC Connection over Wi-Fi
If running `scout-backend` locally (`python -m uvicorn app.main:app --reload`):
1. Find your computer's local Wi-Fi IP address (e.g. `192.168.1.15`).
2. In the mobile app's **Profile & Settings** screen, set the URL to:
   `http://192.168.1.15:8000`
3. Tap **Save & Test URL**. The app will immediately persist this address!
