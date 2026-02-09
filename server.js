const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const https = require('https');

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/redirect', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    // Redirect back to app with error
    res.redirect(`/?error=${encodeURIComponent(error)}`);
  } else if (code) {
    // Redirect back to app with code
    res.redirect(`/?code=${encodeURIComponent(code)}`);
  } else {
    // No code or error, redirect to home
    res.redirect('/');
  }
});

app.post('/api/token-exchange', async (req, res) => {
  try {
    const { tokenEndpoint, authHeader, body } = req.body;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: body,
      agent: new https.Agent({ rejectUnauthorized: false })
    });
    const responseText = await response.text();
    if (response.ok) {
      res.json(JSON.parse(responseText));
    } else {
      res.status(response.status).json({ error: responseText });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`🚀 Hotel API Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('📱 React app: http://localhost:4001');
    console.log('🔧 API server: http://localhost:4002');
  }
});
