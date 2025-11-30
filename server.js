// --- at the top (after requires) ---
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static('public')); // make sure this is present and before routes

const dataDir = path.join(__dirname,'data');
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// load admin password from env
const ADMIN_PASS = process.env.ADMIN_PASS || 'satvik123';
console.log('ADMIN PASSWORD ➜', ADMIN_PASS);

// safe append that reads/writes atomically
function appendJsonSafe(file, obj){
  const filePath = path.join(dataDir, file);
  let arr = [];
  if(fs.existsSync(filePath)){
    try{ arr = JSON.parse(fs.readFileSync(filePath, 'utf8')) || []; }catch(e){ arr=[]; }
  }
  arr.push(obj);
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
}

// simple validators
function validPhone(p){
  return typeof p === 'string' && p.trim().length >= 7 && /^[0-9+ -]+$/.test(p);
}
function validNonEmpty(s){
  return typeof s === 'string' && s.trim().length > 0;
}
function validISODate(s){
  if(!s) return true; // allow empty preferred time
  // try to parse to Date (safe)
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

// --- API routes ---
app.post('/api/book', (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const tests = (body.tests || '').trim();
  const address = (body.address || '').trim();
  const time = (body.time || '').trim();

  if(!validNonEmpty(name) || !validPhone(phone) || !validNonEmpty(tests) || !validNonEmpty(address)){
    return res.status(400).json({ error: 'Missing or invalid fields: name, phone, tests, address are required.' });
  }
  if(!validISODate(time)){
    return res.status(400).json({ error: 'Invalid preferred time format.' });
  }

  const booking = {
    id: Date.now().toString(),
    name, phone, tests, address,
    time: time || null,
    createdAt: new Date().toISOString()
  };

  try{
    appendJsonSafe('bookings.json', booking);
    console.log('New booking', booking);
    // (optional) send confirmation email here...
    return res.json({ ok: true, id: booking.id });
  }catch(err){
    console.error('Failed to save booking', err);
    return res.status(500).json({ error: 'Failed to save booking' });
  }
});

app.post('/api/contact', (req,res) => {
  const body = req.body || {};
  const name = (body.name || '').trim();
  const msg = (body.msg || '').trim();
  if(!validNonEmpty(name) || !validNonEmpty(msg)) return res.status(400).json({ error: 'Missing fields' });

  try{
    appendJsonSafe('contacts.json', { id: Date.now().toString(), name, msg, email: body.email || null, createdAt:new Date().toISOString() });
    console.log('Contact', name);
    return res.json({ ok:true });
  }catch(e){
    return res.status(500).json({ error:'Failed to save contact' });
  }
});

// admin authentication middleware (header or query param)
function adminAuth(req, res, next){
  const pass = req.headers['x-admin-pass'] || req.query.pass;
  if(pass === ADMIN_PASS) return next();
  res.status(401).send('Unauthorized');
}

app.get('/admin/bookings', adminAuth, (req, res) => {
  try{
    const file = path.join(dataDir, 'bookings.json');
    if(!fs.existsSync(file)) return res.json([]);
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(arr);
  }catch(e){
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

// delete booking by id
app.delete('/admin/bookings/:id', adminAuth, (req,res) => {
  const id = req.params.id;
  const file = path.join(dataDir,'bookings.json');
  if(!fs.existsSync(file)) return res.status(404).json({ error:'Not found' });
  try{
    const arr = JSON.parse(fs.readFileSync(file, 'utf8')).filter(b => b.id !== id);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ error:'Failed to delete' });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));