/*
  OuraX Backend API
  =================
  SETUP:
    1. Install Node.js from nodejs.org
    2. Run: npm install
    3. Create .env file (see .env.example)
    4. Run: npm start

  ENDPOINTS:
    POST /api/auth/register     - Create account
    POST /api/auth/login        - Login
    GET  /api/markets           - Get all markets
    POST /api/trades            - Place a trade
    GET  /api/wallet            - Get wallet balance
    POST /api/wallet/buy        - Buy OX coins
    GET  /api/leaderboard       - Get top traders
    GET  /api/positions         - Get my positions
*/

const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

// ─────────────────────────────────────
// DATABASE CONNECTION
// ─────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ourax')
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('DB error:', err));

// ─────────────────────────────────────
// MODELS
// ─────────────────────────────────────

// User Model
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  phone:     { type: String },
  oxBalance: { type: Number, default: 100 },   // 100 free OX on signup
  totalDeposited: { type: Number, default: 0 },
  totalProfit:    { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', UserSchema);

// Market Model
const MarketSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  category:   { type: String, enum: ['Cricket','Sports','Crypto','Politics'], required: true },
  description:{ type: String },
  yesOdds:    { type: Number, default: 50 },
  noOdds:     { type: Number, default: 50 },
  totalVolume:{ type: Number, default: 0 },
  endsAt:     { type: Date, required: true },
  status:     { type: String, enum: ['open','closed','resolved'], default: 'open' },
  result:     { type: String, enum: ['yes','no',null], default: null },
  createdAt:  { type: Date, default: Date.now },
});
const Market = mongoose.model('Market', MarketSchema);

// Trade Model
const TradeSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  marketId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
  side:      { type: String, enum: ['yes','no'], required: true },
  amount:    { type: Number, required: true },
  potential: { type: Number, required: true },
  status:    { type: String, enum: ['open','won','lost'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});
const Trade = mongoose.model('Trade', TradeSchema);

// Transaction Model
const TxSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, enum: ['deposit','withdraw','win','loss','bonus'], required: true },
  amount:  { type: Number, required: true },
  note:    { type: String },
  createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.model('Transaction', TxSchema);

// ─────────────────────────────────────
// MIDDLEWARE - AUTH CHECK
// ─────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'ourax_secret_key');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed, phone });

    // Give welcome bonus
    await Transaction.create({ userId: user._id, type: 'bonus', amount: 100, note: 'Welcome bonus' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'ourax_secret_key', { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, oxBalance: user.oxBalance } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Email not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Wrong password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'ourax_secret_key', { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, oxBalance: user.oxBalance } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
// MARKET ROUTES
// ─────────────────────────────────────

// Get all open markets
app.get('/api/markets', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { status: 'open' };
    if (category) filter.category = category;
    const markets = await Market.find(filter).sort({ totalVolume: -1 });
    res.json(markets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single market
app.get('/api/markets/:id', async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ error: 'Market not found' });
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create market (admin only - add admin check in production)
app.post('/api/markets', auth, async (req, res) => {
  try {
    const { title, category, description, endsAt, yesOdds } = req.body;
    const noOdds = 100 - yesOdds;
    const market = await Market.create({ title, category, description, endsAt, yesOdds, noOdds });
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
// TRADE ROUTES
// ─────────────────────────────────────

// Place a trade
app.post('/api/trades', auth, async (req, res) => {
  try {
    const { marketId, side, amount } = req.body;
    if (!marketId || !side || !amount) return res.status(400).json({ error: 'Missing fields' });
    if (amount < 10) return res.status(400).json({ error: 'Minimum 10 OX per trade' });

    const user   = await User.findById(req.user.id);
    const market = await Market.findById(marketId);

    if (!market || market.status !== 'open')
      return res.status(400).json({ error: 'Market is not open' });
    if (user.oxBalance < amount)
      return res.status(400).json({ error: 'Not enough OX coins' });

    // Calculate potential payout
    const odds     = side === 'yes' ? market.yesOdds / 100 : market.noOdds / 100;
    const potential = Math.round(amount / odds);

    // Deduct balance
    user.oxBalance -= amount;
    await user.save();

    // Update market volume and odds
    market.totalVolume += amount;
    if (side === 'yes') {
      market.yesOdds = Math.min(90, market.yesOdds + 1);
      market.noOdds  = 100 - market.yesOdds;
    } else {
      market.noOdds  = Math.min(90, market.noOdds + 1);
      market.yesOdds = 100 - market.noOdds;
    }
    await market.save();

    const trade = await Trade.create({ userId: req.user.id, marketId, side, amount, potential });
    await Transaction.create({ userId: req.user.id, type: 'loss', amount, note: `Bet on ${market.title}` });

    res.json({ trade, newBalance: user.oxBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my positions
app.get('/api/positions', auth, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.user.id })
      .populate('marketId', 'title category status result')
      .sort({ createdAt: -1 });
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
// WALLET ROUTES
// ─────────────────────────────────────

// Get wallet info
app.get('/api/wallet', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const txs  = await Transaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ oxBalance: user.oxBalance, totalDeposited: user.totalDeposited, totalProfit: user.totalProfit, transactions: txs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buy OX coins (Razorpay integration ready)
app.post('/api/wallet/buy', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 100) return res.status(400).json({ error: 'Minimum ₹100' });

    // TODO: Add Razorpay payment verification here
    // For now, directly add (in production, verify payment first)
    const user = await User.findById(req.user.id);
    user.oxBalance     += amount;
    user.totalDeposited += amount;
    await user.save();

    await Transaction.create({ userId: req.user.id, type: 'deposit', amount, note: `Bought ${amount} OX coins` });
    res.json({ newBalance: user.oxBalance, message: `Added ${amount} OX coins!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}, 'name oxBalance totalProfit')
      .sort({ oxBalance: -1 })
      .limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────
// SEED MARKETS (run once to add sample markets)
// ─────────────────────────────────────
app.post('/api/get', async (req, res) => {
  try {
    await Market.deleteMany({});
    await Market.insertMany([
      { title: 'Will India win the next T20 match vs England?', category: 'Cricket', yesOdds: 68, noOdds: 32, endsAt: new Date(Date.now() + 2*24*60*60*1000) },
      { title: 'Will Virat Kohli score a century in IPL 2026?', category: 'Cricket', yesOdds: 45, noOdds: 55, endsAt: new Date(Date.now() + 5*24*60*60*1000) },
      { title: 'Will Bitcoin cross $100,000 before May 2026?', category: 'Crypto', yesOdds: 52, noOdds: 48, endsAt: new Date(Date.now() + 10*24*60*60*1000) },
      { title: 'Will Ethereum rise above $3,500 this week?', category: 'Crypto', yesOdds: 38, noOdds: 62, endsAt: new Date(Date.now() + 6*24*60*60*1000) },
      { title: 'Will Chennai Super Kings win IPL 2026?', category: 'Sports', yesOdds: 29, noOdds: 71, endsAt: new Date(Date.now() + 30*24*60*60*1000) },
      { title: 'Will Neeraj Chopra win gold at next World Athletics?', category: 'Sports', yesOdds: 71, noOdds: 29, endsAt: new Date(Date.now() + 45*24*60*60*1000) },
    ]);
    res.json({ message: 'Markets seeded!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => res.json({ status: 'OuraX API running!', version: '1.0.0' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`OuraX API running on port ${PORT}`));
