const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

const SECRET = "shaswat-secret-123";
let movies = JSON.parse(fs.readFileSync('./movies.json', 'utf8'));
let users = [];
let watchlists = {}; // {userId: [movieId]}

// --- Get All Movies + Search + Filter ---
app.get('/api/movies', (req, res) => {
  let result = movies;
  const { search, category, trending } = req.query;
  if (search) result = result.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  if (category && category !== 'All') result = result.filter(m => m.cat === category);
  if (trending === 'true') result = result.filter(m => m.rating >= 8.0);
  res.json(result);
});

// --- Get Single Movie ---
app.get('/api/movies/:id', (req, res) => {
  const m = movies.find(x => x.id == req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(m);
});

// --- Register ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), name, email, password: hash };
  users.push(user);
  const token = jwt.sign({ id: user.id, name }, SECRET);
  res.json({ token, user: { id: user.id, name, email } });
});

// --- Login ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: "User not found" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Wrong password" });
  const token = jwt.sign({ id: user.id, name: user.name }, SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email } });
});

// --- Auth Middleware ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Login required" });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
}

// --- Watchlist ---
app.get('/api/watchlist', auth, (req, res) => {
  const ids = watchlists[req.user.id] || [];
  res.json(movies.filter(m => ids.includes(m.id)));
});
app.post('/api/watchlist/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  if (!watchlists[req.user.id]) watchlists[req.user.id] = [];
  if (!watchlists[req.user.id].includes(id)) watchlists[req.user.id].push(id);
  res.json({ success: true });
});
app.delete('/api/watchlist/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  watchlists[req.user.id] = (watchlists[req.user.id] || []).filter(x => x !== id);
  res.json({ success: true });
});

// --- Admin: Add Movie ---
app.post('/api/movies', auth, (req, res) => {
  const newMovie = { id: Date.now(), ...req.body };
  movies.push(newMovie);
  // Render par file save nahi hogi permanent, isliye memory me rahega
  res.json(newMovie);
});

app.get('/', (req, res) => res.send("Shaswat Movies Backend Running 🚀"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));