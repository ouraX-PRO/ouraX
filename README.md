# OuraX - India's Prediction Market
=====================================

## What you have:
- `/backend/server.js`  — Full Node.js API
- `/frontend/index.html` — Complete website

---

## STEP 1 — Install Node.js
Go to: https://nodejs.org
Download and install the LTS version.

---

## STEP 2 — Set up free MongoDB database
1. Go to: https://mongodb.com/atlas
2. Sign up for free
3. Create a free cluster
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: mongodb+srv://...)

---

## STEP 3 — Set up backend
Open black window (cmd) and type:

  cd Desktop\ourax\backend
  npm install
  copy .env.example .env

Open .env in Notepad and paste your MongoDB connection string.

Then run:
  npm start

You should see: "OuraX API running on port 5000"

---

## STEP 4 — Seed the markets (add sample data)
Open your browser and go to:
  http://localhost:5000/api/seed

You should see: {"message":"Markets seeded!"}

---

## STEP 5 — Open the website
Just open frontend/index.html in your browser!
Register an account and start trading.

---

## STEP 6 — Host online for free
FRONTEND (website):
  1. Go to: https://vercel.com
  2. Sign up free
  3. Upload your frontend folder
  4. Done! You get a free URL like: ourax.vercel.app

BACKEND (API):
  1. Go to: https://render.com
  2. Sign up free
  3. Connect your backend folder
  4. Add environment variables from .env
  5. Done! You get a free API URL

---

## Features included:
- User registration & login
- 6 live markets (Cricket, Crypto, Sports)
- Place trades with OX coins
- My positions page
- Leaderboard
- Wallet with buy/withdraw
- 100 free OX coins on signup

## Coming next (Phase 2):
- Razorpay real payments
- Admin panel
- Push notifications
- React Native mobile app
