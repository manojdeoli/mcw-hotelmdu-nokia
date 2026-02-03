const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = 'f3a0e2b1-4c5d-6e7f-8a9b-0c1d2e3f4a5b';
const CLIENT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

app.post('/api/token-exchange', async (req, res) => {
  const { code, redirect_uri } = req.body;
  try {
    const response = await axios.post(
      'https://network-as-code.p-eu.rapidapi.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-host': 'network-as-code.p-eu.rapidapi.com',
          'x-rapidapi-key': '5f2dbafafamsh87b419851b02d59p1c9ce3jsncbbd0bf87a70'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3003;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
