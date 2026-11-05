const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "shaswat-secret";
const TMDB_KEY = process.env.TMDB_API_KEY; // <-- Render se Key yahan aayegi

let movies = [];
try { movies = JSON.parse(fs.readFileSync(path.join(__dirname, 'movies.json'), 'utf8')); } catch(e){ movies = []; }
let users = [];

// Home check
app.get('/', (req,res) => res.send('Shaswat Movies Backend Running 🚀 | TMDB: ' + (TMDB_KEY ? 'Connected ✅' : 'Key Missing ❌')));

// Apni wali movies
app.get('/api/movies', (req,res) => {
  let result = [...movies];
  const { search, category } = req.query;
  if(category && category !== 'All') result = result.filter(m => m.cat === category);
  if(search) result = result.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  res.json(result);
});

app.get('/api/movies/:id', (req,res) => {
  const m = movies.find(x => x.id == req.params.id);
  if(m) res.json(m); else res.status(404).json({error:'Not found'});
});

// *** NAYA - TMDB SEARCH ***
app.get('/api/search', async (req,res) => {
  const q = req.query.q;
  if(!q) return res.json([]);
  if(!TMDB_KEY) return res.status(500).json({error:'TMDB Key Render me nahi mili'});

  try{
    const r = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
      params: { api_key: TMDB_KEY, query: q, language: 'hi-IN', page: 1 }
    });
    const data = r.data.results.slice(0,20).map(m => ({
      id: 'tmdb-'+m.id,
      name: m.title,
      cat: 'TMDB',
      year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
      rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
      img: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster',
      desc: m.overview || 'Koi description nahi hai.',
      video: ''
    }));
    res.json(data);
  }catch(e){ res.status(500).json({error:'TMDB se nahi aaya'}); }
});

// Auth + Watchlist (Pehle wala same)
function auth(req,res,next){
  const t = req.headers.authorization?.split(' ')[1];
  if(!t) return res.status(401).json({error:'Login karo'});
  try{ req.user = jwt.verify(t, JWT_SECRET); next(); }catch{ res.status(401).json({error:'Token galat'}); }
}
app.post('/api/auth/register', async (req,res)=>{
  const {name,email,password} = req.body;
  if(users.find(u=>u.email===email)) return res.status(400).json({error:'Email pehle se hai'});
  const hash = await bcrypt.hash(password,10);
  const user = {id: Date.now(), name, email, password: hash, watchlist: []};
  users.push(user);
  const token = jwt.sign({id:user.id}, JWT_SECRET);
  res.json({token, user:{id:user.id, name, email}});
});
app.post('/api/auth/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = users.find(u=>u.email===email);
  if(!user) return res.status(400).json({error:'User nahi mila'});
  if(!(await bcrypt.compare(password, user.password))) return res.status(400).json({error:'Password galat'});
  const token = jwt.sign({id:user.id}, JWT_SECRET);
  res.json({token, user:{id:user.id, name:user.name, email}});
});
app.post('/api/watchlist/:id', auth, (req,res)=>{
  const user = users.find(u=>u.id===req.user.id);
  if(!user.watchlist.includes(req.params.id)) user.watchlist.push(req.params.id);
  res.json({success:true});
});
app.get('/api/watchlist', auth, (req,res)=>{
  const user = users.find(u=>u.id===req.user.id);
  res.json(movies.filter(m=>user.watchlist.includes(String(m.id))));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Server running on '+PORT));