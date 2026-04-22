// server.js - tiny Express backend for Render
require('dotenv').config(); // loads .env locally (ignored in repo)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets (index.html, style.css, app.js, etc.)
app.use(express.static(path.resolve(__dirname)));

// Config endpoint - returns Supabase & password vars from Render env
app.get('/config', (req, res) => {
  res.json({
    SUPABASE_URL:     process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY:process.env.SUPABASE_ANON_KEY,
    BUCKET_NAME:      process.env.SUPABASE_BUCKET,
    TABLE_NAME:       process.env.SUPABASE_TABLE,
    PASS_MEMBER:      process.env.PASS_MEMBER,
    PASS_OWNER:       process.env.PASS_OWNER
  });
});

// Optional health-check endpoint
app.get('/health', (_, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
