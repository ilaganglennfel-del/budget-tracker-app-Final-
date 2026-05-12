# 💸 Budget Tracker — P2P Gamified App

A full-stack, secure, gamified P2P budgeting app.

**Stack:** React Native (Expo) · Node.js/Express · PostgreSQL

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- Docker & Docker Compose (for PostgreSQL)
- Expo Go app on your phone **or** Android/iOS simulator

---

### 1. Start the Database

```bash
cd backend
docker-compose up -d
```

PostgreSQL will start on port `5432`. The schema is applied automatically on first boot.

---

### 2. Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set strong secrets:
```
JWT_ACCESS_SECRET=your_long_random_secret_here
JWT_REFRESH_SECRET=another_long_random_secret_here
```

---

### 3. Run the Backend

```bash
cd backend
npm install
npm run dev
```

API runs at: `http://localhost:3000`
Health check: `http://localhost:3000/health`

---

### 4. Configure Frontend API URL

Open `frontend/services/api.ts` and update `API_BASE_URL`:

```ts
// For physical device: use your machine's local IP
export const API_BASE_URL = 'http://192.168.x.x:3000/api';

// For Android emulator:
export const API_BASE_URL = 'http://10.0.2.2:3000/api';

// For iOS simulator:
export const API_BASE_URL = 'http://localhost:3000/api';
```

---

### 5. Run the Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login, get tokens |
| POST | `/api/auth/refresh` | ❌ | Refresh access token |
| GET | `/api/users/me` | ✅ | Get profile + balance |
| GET | `/api/users/search?email=` | ✅ | Find recipient (masked) |
| POST | `/api/users/deposit` | ✅ | Add funds to account |
| POST | `/api/transfers` | ✅ | Atomic P2P transfer |
| GET | `/api/transfers` | ✅ | Transaction history |
| GET | `/api/goals` | ✅ | List goals + daily targets |
| POST | `/api/goals` | ✅ | Create goal |
| PATCH | `/api/goals/:id` | ✅ | Update goal / add savings |
| DELETE | `/api/goals/:id` | ✅ | Delete goal |
| POST | `/api/streaks/ping` | ✅ | App-open streak trigger |
| GET | `/api/streaks` | ✅ | Get streak data |
| POST | `/api/streaks/restore` | ✅ | Restore broken streak |
| GET | `/api/streaks/history` | ✅ | Streak event audit log |

---

## 🔒 Security Design

| Concern | Solution |
|---------|----------|
| Auth | JWT access (15m) + refresh (7d), stored in Expo SecureStore |
| Input validation | Zod schemas on every route — rejects malformed input before DB |
| SQL injection | 100% parameterized queries (`$1`, `$2`…), never string interpolation |
| Data isolation | All queries filter by `req.user.uid` from verified JWT |
| Race conditions | `BEGIN / SELECT FOR UPDATE / COMMIT` on all financial ops |
| Rollback | Any failure in transfer chain triggers `ROLLBACK` |
| Rate limiting | `/api/auth`: 20 req/15min · `/api`: 120 req/min |

---

## 🎮 Gamification

### Streak Badges
| Badge | Threshold | Emoji |
|-------|-----------|-------|
| Seedling | 0+ days | 🌱 |
| Sprout | 5+ days | 🌿 |
| Plant | 10+ days | 🪴 |
| Tree | 15+ days | 🌳 |

- Streak increments on **first app open of each UTC day**
- Broken streak (missed a day) resets to 1
- **Restore**: free, capped at **5 per calendar month**, logged in `streak_metadata`

### Goal Daily Target Formula
```
dailyTarget = (targetAmount - currentAmount) / max(1, daysRemaining)
```
- **Overdue** goals: `daysRemaining` is floored to 1 (never crashes, never divides by zero)
- Status: `on_track` | `overdue` | `completed`

---

## 🗃️ Database Schema

```
users            — id, email, password_hash, first_name, last_name, balance
transactions     — id, sender_id, receiver_id, amount, type, status, note
goals            — id, user_id, name, target_amount, current_amount, target_date, emoji
streaks          — id, user_id, current_streak, longest_streak, badge_level, restore_uses_this_month
streak_metadata  — id, user_id, event_type, streak_value, event_date
```

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Covers: `calcDailyTarget` (on-track, overdue, completed, same-day) · `getBadge` thresholds

---

## 📁 Project Structure

```
budget-tracker-app/
├── backend/
│   ├── migrations/001_initial_schema.sql
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/auth.js · validate.js · errorHandler.js
│   │   ├── routes/auth.js · users.js · transfers.js · goals.js · streaks.js
│   │   └── services/transferService.js · streakService.js
│   └── docker-compose.yml
└── frontend/
    ├── app/
    │   ├── _layout.tsx         ← root auth guard
    │   ├── (auth)/login.tsx · register.tsx
    │   └── (tabs)/home.tsx · transfers.tsx · goals.tsx · profile.tsx
    ├── components/GlassCard · SkeletonLoader · Toast · StreakBadge
    ├── services/api.ts
    ├── store/authStore.ts
    └── theme/index.ts
```
