# Future Database Implementations

Currently, the "Following Dashboard" feature is deferred until we integrate a database for user accounts and preferences. 

## Vision
A personalized home feed that filters out the noise, showing only the teams and leagues you care about (similar to the favorites tab on Sofascore).

## Implementation Plan (Post-DB)

1. **Database Schema**:
   - `users`: table for user authentication (id, email, password_hash, created_at)
   - `user_favorites`: join table for tracking favorites (user_id, entity_type ['team', 'league', 'player'], entity_id)

2. **Backend Endpoints (`scout-backend`)**:
   - `POST /api/users/favorites`: Add a new team/league to favorites.
   - `DELETE /api/users/favorites/{id}`: Remove a favorite.
   - `GET /api/users/favorites`: Return all tracked favorites for the current user.
   - `GET /api/dashboard`: A curated endpoint that queries the BSD API for fixtures & results *only* for the `team_id`s and `league_id`s present in the user's favorites.

3. **Frontend Implementation (`scout-web`)**:
   - Add a 'star' or 'heart' icon on Team, League, and Player pages.
   - Create a `Dashboard` tab on the homepage that fetches from `/api/dashboard`.
   - The UI should group fixtures by league (showing only favorited leagues and matches involving favorited teams).

## Local Storage Alternative
If we decide not to use a database, we can store `favorites` in the browser's `localStorage` (e.g., `["team_233", "league_12"]`) and have the frontend construct parallel requests to the existing BSD endpoints. However, a backend DB is the preferred scalable approach.

---

# Phase 3: Deep Football Context (Future Implementations)

These features either require a database or advanced third-party data stitching, and have been documented here for future development:

## Transfer Center
- **Vision**: A dedicated hub for confirmed transfers, loan deals, and rumors, filterable by league or specific team.
- **Implementation**: A new database schema for transfer events linked to player and team profiles, integrating with an existing news feed system or a dedicated transfer API.

## Injuries & Suspensions
- **Vision**: A pre-match roster indicating which key players are unavailable, the nature of their absence, and expected return dates.
- **Implementation**: Cross-reference team squad lists with injury reports from the BSD data provider (via `injury_type`) to flag unavailable players in the match preview UI.

## Tournament Brackets
- **Vision**: Visual progression trees for knockout competitions like the Champions League or FA Cup.
- **Implementation**: A custom frontend component that maps bracket data (round of 16, quarter-finals, etc.) into a branching visual hierarchy.

## TV & Streaming Schedules
- **Vision**: A section on the match details page telling the user exactly what channel or app is broadcasting the game in their region.
- **Implementation**: Requires geographic mapping to match the user's IP/location with regional broadcast rights data (fetching from the BSD `/broadcasts/` endpoint).
