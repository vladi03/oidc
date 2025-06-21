const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Provider } = require('oidc-provider');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

if (!admin.apps.length) {
  admin.initializeApp();
}

const issuer = process.env.OIDC_ISSUER || 'http://localhost:3000';

const issuerUrl = new URL(issuer);
const basePath = issuerUrl.pathname.replace(/\/$/, '');
console.log(basePath);
console.log("~~~~~~~~~~~~~~~~~~~~~~~~~");

const jwks = require('./jwks.json');

const configuration = {
  clients: [
    {
      client_id: 'oidc_ui_tester',
      redirect_uris: [
        'http://localhost:3000/callback',
        'http://localhost:5001/callback',
        'https://your-production-app.com/callback'
      ],
      response_types: ['code'], //, 'id_token'
      grant_types: ['authorization_code'], //, 'implicit'
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
      console.log(`~~~~~~~~~~ findAccount for ${user.email} ~~~~~~~~~~`);
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
oidc.proxy = true;

// Post-middleware to override jwks_uri in the discovery document
oidc.use(async (ctx, next) => {
  await next();

  // ctx.oidc.route === 'discovery' means we’re handling GET /.well-known/openid-configuration
  if (ctx.oidc && ctx.oidc.route === 'discovery') {
    ctx.body.jwks_uri = `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`;
  }
});

const app = express();
app.set('trust proxy', true);
// Ensure generated URLs use the configured issuer and mount path
app.use((req, res, next) => {
  req.headers['x-forwarded-host'] = issuerUrl.host;
  req.headers['x-forwarded-proto'] = issuerUrl.protocol.replace(':', '');
  req.baseUrl = basePath;
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

    const data = await resp.json();
    console.log(`~~~~~~~~~~  Login successfully! ${email}-${data.localId} - ${details.prompt.name} ~~~~~~~~~~~`);
    console.log('➡️  prompt.name =', details.prompt.name);
    console.log('➡️  prompt.name =', data);
    res.redirect(`https://your-production-app.com/callback#id_token=${data.idToken}`);

    /*
    const result = {
      login: { accountId: data.localId },
      consent: {
        // grant exactly the scopes the client asked for
        grantScope: 'openid'
      },
    };



    return  oidc.interactionFinished(req, res, result, {
      mergeWithLastSubmission: false
    });
  */
  } catch (err) {
    next(err);
  }
});

app.use(oidc.callback());

exports.oidc = functions.https.onRequest(app);
