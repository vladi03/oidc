const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Provider } = require('oidc-provider');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

admin.initializeApp();

const issuer = process.env.OIDC_ISSUER || 'http://localhost:3000';

const basePath = "http://127.0.0.1:5001/netware-326600/us-central1/oidc"; //= new URL(issuer).pathname.replace(/\/$/, '');
console.log(basePath);
console.log("~~~~~~~~~~~~~~~~~~~~~~~~~");

const jwks = require('./jwks.json');

const configuration = {
  clients: [
    {
      client_id: 'oidc_ui_tester',
      redirect_uris: [
        'http://localhost:3000/callback',
        'https://your-production-app.com/callback'
      ],
      response_types: ['code'],
      grant_types: ['authorization_code'],
      token_endpoint_auth_method: 'none'
    }
  ],
  jwks,
  pkce: { required: () => true },
  features: {
    devInteractions: { enabled: false },
    revocation: { enabled: true }
  },
  interactions: {
    url: (ctx, interaction) => `${basePath}/interaction/${interaction.uid}`
  },
  findAccount: async (ctx, id) => {
    try {
      const user = await admin.auth().getUser(id);
      return {
        accountId: id,
        async claims() {
          return {
            sub: id,
            email: user.email,
            email_verified: user.emailVerified
          };
        }
      };
    } catch (err) {
      return undefined;
    }
  }
};

const oidc = new Provider(issuer, configuration);

const app = express();

app.use((req, res, next) => {
  if (basePath) {
    req.baseUrl = basePath;
  }
  next();
});

app.use('/token', cors());
app.use('/me', cors());
app.use('/userinfo', cors());

app.get('/interaction/:uid', async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    res.send(`<!DOCTYPE html>
<html lang="en">
  <body>
    <h1>Login</h1>
    <form method="post" action="${basePath}/interaction/${details.uid}/login">
      <label>Email: <input type="email" name="email" /></label><br/>
      <label>Password: <input type="password" name="password" /></label><br/>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`);
  } catch (err) {
    next(err);
  }
});

app.post('/interaction/:uid/login', express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    const { email, password } = req.body;
    const apiKey = process.env.FB_API_KEY;
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });


    if (!resp.ok) {
      res.redirect(`${basePath}/interaction/${details.uid}?error=login_failed`);
      return;
    }
    console.log(`~~~~~~~~~~  Login successfully! ${email}  ~~~~~~~~~~~`);
    const data = await resp.json();
    const result = {
      login: { accountId: data.localId }
    };
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
  } catch (err) {
    next(err);
  }
});

app.use(oidc.callback());

exports.oidc = functions.https.onRequest(app);
