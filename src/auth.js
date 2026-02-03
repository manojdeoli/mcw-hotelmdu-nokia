const CLIENT_ID = 'f3a0e2b1-4c5d-6e7f-8a9b-0c1d2e3f4a5b';
const CLIENT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const REDIRECT_URI = 'http://localhost:3000/callback';

class AuthService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getClientCredentials() {
    const response = await fetch('https://network-as-code.p-eu.rapidapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-rapidapi-host': 'network-as-code.p-eu.rapidapi.com',
        'x-rapidapi-key': '5f2dbafafamsh87b419851b02d59p1c9ce3jsncbbd0bf87a70'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });
    return response.json();
  }

  async getEndpoints() {
    const response = await fetch('https://network-as-code.p-eu.rapidapi.com/.well-known/openid-configuration', {
      headers: {
        'x-rapidapi-host': 'network-as-code.p-eu.rapidapi.com',
        'x-rapidapi-key': '5f2dbafafamsh87b419851b02d59p1c9ce3jsncbbd0bf87a70'
      }
    });
    return response.json();
  }

  async authenticate() {
    const endpoints = await this.getEndpoints();
    const authUrl = `${endpoints.authorization_endpoint}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=openid`;
    window.location.href = authUrl;
  }

  async exchangeCodeForToken(code) {
    const response = await fetch('/api/token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
    });
    const data = await response.json();
    if (data.access_token) {
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token_expiry', this.tokenExpiry.toString());
    }
    return data;
  }

  async checkAndHandleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      await this.exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    const storedToken = localStorage.getItem('access_token');
    const storedExpiry = localStorage.getItem('token_expiry');
    if (storedToken && storedExpiry) {
      this.accessToken = storedToken;
      this.tokenExpiry = parseInt(storedExpiry);
      if (this.isTokenValid()) return true;
    }
    return false;
  }

  isTokenValid() {
    return this.accessToken && this.tokenExpiry && Date.now() < (this.tokenExpiry - 30000);
  }

  getTimeUntilExpiry() {
    if (!this.tokenExpiry) return 0;
    return Math.max(0, Math.floor((this.tokenExpiry - Date.now()) / 1000));
  }
}

export default new AuthService();
