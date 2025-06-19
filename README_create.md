
* An OIDC server using `oidc-provider` hosted on Firebase Functions, backed by Firebase user pool
* A React SPA tester that logs in, logs out, and displays token data
* A Postman collection testing token exchange, refresh, and userinfo endpoints
* GitHub Actions pipelines to deploy both the OIDC server and the React SPA to Firebase
* All required Firebase config files and environment setup instructions

# Custom OIDC Provider with Firebase – Comprehensive Guide

This repository contains three main projects, each in its own directory:

* **`oidc_server`** – A Node.js OpenID Connect (OIDC) Provider server using the [`oidc-provider` library](https://github.com/panva/node-oidc-provider), deployed on Firebase Cloud Functions and integrated with Firebase Authentication as the user identity backend.
* **`oidc_ui_tester`** – A React Single Page Application (SPA) that serves as a client tester for the OIDC provider. It allows users to log in via the OIDC server, view their tokens, refresh them, and log out. It uses an OIDC client library (such as `oidc-client-ts`) for handling the authentication flows.
* **`oidc_postman`** – A Postman collection (provided as a JSON file) for testing the OIDC server’s endpoints (authorization code exchange, token refresh, and the UserInfo endpoint), including a simulation of the authorization code flow with PKCE.

In addition, this guide covers the **Continuous Integration/Continuous Deployment (CI/CD)** setup using GitHub Actions for both the OIDC server and the SPA client, including deployment to Firebase (Functions and Hosting). We also provide instructions for initializing the Firebase project, managing configuration for local development, setting up required secrets, and using the Postman collection.

## Table of Contents

1. [OIDC Provider Server (`oidc_server`)](#oidc-provider-server-oidc_server)
   1.1 [Features and Libraries](#features-and-libraries)
   1.2 [Configuration (Issuer, JWKS, Firebase Auth)](#configuration-issuer-jwks-firebase-auth)
   1.3 [Firebase Functions Deployment](#firebase-functions-deployment)
   1.4 [Using Firebase Authentication as Identity Backend](#using-firebase-authentication-as-identity-backend)
   1.5 [Codex Prompt – Generate OIDC Server Code](#codex-prompt--generate-oidc-server-code)

2. [SPA OIDC Client Tester (`oidc_ui_tester`)](#spa-oidc-client-tester-oidc_ui_tester)
   2.1 [Features and Libraries](#features-and-libraries-1)
   2.2 [Configuration (Client ID, Redirect URIs, CORS)](#configuration-client-id-redirect-uris-cors)
   2.3 [Running the SPA and Firebase Hosting Setup](#running-the-spa-and-firebase-hosting-setup)
   2.4 [Codex Prompt – Generate OIDC SPA Client Code](#codex-prompt--generate-oidc-spa-client-code)

3. [Postman Test Collection (`oidc_postman`)](#postman-test-collection-oidc_postman)
   3.1 [Included Requests and Flow](#included-requests-and-flow)
   3.2 [Using the Postman Collection](#using-the-postman-collection)
   3.3 [Codex Prompt – Generate Postman Collection JSON](#codex-prompt--generate-postman-collection-json)

4. [Firebase Project Initialization & Configuration](#firebase-project-initialization--configuration)
   4.1 [Creating and Setting up the Firebase Project](#creating-and-setting-up-the-firebase-project)
   4.2 [Initializing Firebase Functions and Hosting](#initializing-firebase-functions-and-hosting)
   4.3 [Local Development and Emulators](#local-development-and-emulators)

5. [Configuration Management & Environment Secrets](#configuration-management--environment-secrets)
   5.1 [Environment Variables for OIDC Server](#environment-variables-for-oidc-server)
   5.2 [Environment Variables for SPA (React)](#environment-variables-for-spa-react)
   5.3 [Secure Storage of Secrets](#secure-storage-of-secrets)

6. [CI/CD Pipeline Setup (GitHub Actions)](#cicd-pipeline-setup-github-actions)
   6.1 [GitHub Actions Overview](#github-actions-overview)
   6.2 [Configuring Firebase Deployment Credentials (FIREBASE\_TOKEN)](#configuring-firebase-deployment-credentials-firebasetoken)
   6.3 [CI Workflow – Deploy OIDC Server (Functions)](#ci-workflow--deploy-oidc-server-functions)
   6.4 [CI Workflow – Deploy SPA Client (Hosting)](#ci-workflow--deploy-spa-client-hosting)
   6.5 [Codex Prompt – Generate GitHub Actions Workflow (Functions)](#codex-prompt--generate-github-actions-workflow-functions)
   6.6 [Codex Prompt – Generate GitHub Actions Workflow (Hosting)](#codex-prompt--generate-github-actions-workflow-hosting)

---

## OIDC Provider Server (`oidc_server`)

This section describes the **OIDC Provider** server implemented in Node.js using the `oidc-provider` library. The OIDC server is designed to run on **Firebase Cloud Functions** and uses **Firebase Authentication** as the identity user store. It issues OIDC-compliant tokens (ID Token, Access Token, Refresh Token) to authenticated users and exposes standard OIDC endpoints (authorization, token, userinfo, JWKS, etc.).

### Features and Libraries

* **Node.js & Firebase Functions:** The server is built with Node.js and deployed as a Firebase Cloud Function for scalability and easy integration with Firebase services. Ensure your Functions runtime Node version is compatible (e.g., Node 14+). This can be set in `package.json` (`"engines": {"node": "14"}`) or in `firebase.json`.
* **`oidc-provider` Library:** We use the popular `oidc-provider` Node library to handle the heavy lifting of the OIDC protocol. It provides endpoints like `/authorize`, `/token`, `/userinfo`, and `.well-known/openid-configuration` out of the box, which we configure for our needs.
* **Express Framework:** The function will use an Express app to integrate with `oidc-provider`. The Express app is exported as a single Cloud Function (e.g., `exports.oidc = functions.https.onRequest(app)`), allowing Firebase to handle HTTP requests to the OIDC endpoints.
* **Firebase Admin SDK:** The server uses the Firebase Admin SDK to interact with Firebase Authentication (for example, to look up user information). It also can use Firestore or another database if needed for storing sessions or adapter data, though a simple in-memory or stateless approach can be used for a basic setup.

### Configuration (Issuer, JWKS, Firebase Auth)

Proper configuration of the OIDC provider is critical:

* **Issuer URL:** This is the base URL at which your OIDC provider is accessible. It needs to be configured when instantiating the provider. If using Firebase Functions without a custom domain, the issuer might be something like `https://us-central1-<YOUR_FIREBASE_PROJECT>.cloudfunctions.net/oidc` (if your function is named “oidc” and located in `us-central1`). If you set up a custom domain or use Firebase Hosting rewrites, it could be a more friendly URL (e.g., `https://<YOUR_DOMAIN>`. For consistency, update the issuer in the provider configuration to match the actual URL clients will use. This issuer will appear in the discovery document (`/.well-known/openid-configuration`) and in tokens as the issuer claim.
* **Static JWKS (JSON Web Key Set):** By default, `oidc-provider` will generate signing keys for tokens if not provided. In a serverless environment like Cloud Functions, **keys must persist across instances** to validate tokens (especially long-lived tokens or reuse of refresh tokens). It’s recommended to provide a static JWKS or key configuration:

  * One approach is to pre-generate an RSA key pair and embed the private key in the configuration (or load from secure storage), so the JWKS (public keys) remains constant. You can generate a JWKS JSON containing your keys and include it in the config (or host it at a static endpoint).
  * Alternatively, configure the `oidc-provider` to use a custom keystore. For example, you might store keys in Firestore or Cloud Storage so that new function instances load the same keys.
  * Simpler: for development or initial testing, you can generate a new key on startup but **this will rotate keys on each cold start**, which may invalidate tokens. So for production, use static keys.
* **Client Configuration:** Define at least one OIDC client (relying party) in the provider configuration. This is the application allowed to request tokens. For the included SPA tester, define a client with:

  * `client_id`: e.g., `"oidc_ui_tester"` (or any identifier)
  * No client secret (use PKCE for authentication instead of a client secret, so set `token_endpoint_auth_method` to `"none"` for this client).
  * `redirect_uris`: the allowed callback URLs for your SPA. For example, `["http://localhost:3000/callback", "https://<YOUR_PROJECT>.web.app/callback"]` (include the development and production URIs). Make sure these URIs correspond to the route the SPA will handle after login.
  * `grant_types`: include `"authorization_code"` (for the Auth Code flow) and `"refresh_token"` if you want refresh tokens to be usable.
  * `response_types`: include `"code"` (since we use the code flow).
  * `scope`: you can configure default scopes or just allow the SPA to request scopes like `openid`, `email`, `profile`, etc. Ensure that `"openid"` is included as it’s required for OIDC.
* **Firebase Admin Initialization:** In the Cloud Function, initialize the Firebase Admin SDK to interact with your Firebase project. For example:

  ```js
  const admin = require('firebase-admin');
  admin.initializeApp(); // uses default service account credentials in Cloud Function
  ```

  This will allow you to query users. No additional config is needed if the Cloud Function runs in the same project as your Firebase Auth; it will use the project’s default credentials. For local testing, you may need to provide credentials (see [Local Development](#local-development-and-emulators)).
* **Integrating Firebase Auth (User Identity):** *See next section for details on using Firebase Authentication as the identity store.* In short, the OIDC provider needs to know **how to authenticate users**. We will implement custom logic such that when the user attempts to log in (for example, via the `/authorize` endpoint prompting for credentials), the server uses Firebase Auth to verify the credentials:

  * If using email/password: The server can call Firebase Auth’s REST API (Identity Toolkit) to **verify email and password** and retrieve the user’s UID if valid. Firebase Admin SDK does not provide a direct password verification (for security reasons), so using the **Firebase Authentication REST API** with the Firebase web API key is a typical solution in a custom auth system. For example, a request to the [`accounts:signInWithPassword` endpoint](https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>) with email and password will return an ID token if the credentials are correct. The OIDC server can use this as proof of authentication (and maybe decode it to get user info).
  * Alternatively, you can use the Firebase Admin SDK to create custom tokens or to fetch user data by email (to ensure the user exists) and compare password hashes, but Firebase doesn’t expose password hashes directly. So using the official API to verify password is simpler.
  * The result should be an authenticated Firebase user (UID). The OIDC provider can then create an OIDC session for that user and issue an ID token with the appropriate claims (perhaps including the Firebase UID as the OIDC subject).
* **UserInfo Endpoint:** If using Firebase Auth, user profile information (like email, display name) can be fetched via Admin SDK (`admin.auth().getUser(uid)`) and then returned on the `/userinfo` endpoint. The `oidc-provider` library allows defining custom claims for ID tokens and the userinfo response. We will configure it to include claims like `email`, `email_verified`, `name`, etc., using data from Firebase.

#### Example Configuration Snippet

Within the Node.js function code (for example, an `index.js` or similar in `oidc_server` directory), you might have a setup like:

```js
const { Provider } = require('oidc-provider');
const express = require('express');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const OIDC_ISSUER = process.env.OIDC_ISSUER || 'https://<YOUR_PROJECT>.cloudfunctions.net/oidc';

// Define a basic account model for oidc-provider using Firebase Auth
const Account = {
  // findAccount is called by oidc-provider to get user account details by ID
  async findAccount(ctx, id) {
    // id could be a Firebase UID in this case
    try {
      const userRecord = await admin.auth().getUser(id);
      return {
        accountId: id,
        // claims() method should return the claims for the ID Token or UserInfo
        async claims(use, scope) {
          return {
            sub: id,
            email: userRecord.email,
            email_verified: userRecord.emailVerified || false,
            name: userRecord.displayName || userRecord.email
            // ... other custom claims if needed
          };
        }
      };
    } catch (err) {
      return undefined; // user not found
    }
  }
};

// OIDC provider configuration
const oidcConfig = {
  // List of clients allowed
  clients: [
    {
      client_id: 'oidc_ui_tester',
      redirect_uris: ['http://localhost:3000/callback'],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none', // public client (no client secret)
    }
  ],
  findAccount: Account.findAccount,
  // Enable Refresh Token support
  features: {
    // by default, authorizationCode with PKCE is enabled; you can explicitly require PKCE here
    pkce: { required: () => true },
    // refresh tokens
    refreshToken: { enabled: true }
  },
  // Provide a static JWKS (for example, loaded from a JWKS.json file or env variable)
  jwks: require('./jwks.json')  // assume you have a JWKS JSON file with your keys
};

// Create OIDC provider instance
const oidc = new Provider(OIDC_ISSUER, oidcConfig);

// Create Express app and mount oidc-provider routes
const app = express();

// Optionally enable CORS for OIDC endpoints, so the SPA can call token and userinfo endpoints
const cors = require('cors');
app.use(cors({ origin: [ 'http://localhost:3000', 'https://<YOUR_PROJECT>.web.app' ] }));

// Attach oidc-provider callback to express (all its routes under '/')
app.use(oidc.callback());

// Export the Cloud Function
exports.oidc = require('firebase-functions').https.onRequest(app);
```

> **Note:** The above snippet is a simplified outline. In a real implementation, you need to add proper error handling, and implement the actual **interaction (login) logic** for `/authorize` requests. The `oidc-provider` library by default shows a simple login page for development (if `features.devInteractions` is enabled). In production, you’d disable dev interactions and handle the login prompt yourself:
>
> * You might create a custom Express route for `GET /interaction/:uid` that displays a login form (or redirects to a Firebase Hosted login page).
> * A corresponding `POST /interaction/:uid/login` to process credentials (email/password), verify via Firebase, then call `oidc.interactionFinished()` to continue the OIDC flow.
> * For simplicity, you could also accept credentials via the query (not recommended for real apps) or use a Resource Owner Password flow in testing (also not recommended in production).

### Firebase Functions Deployment

The OIDC server is deployed as a Firebase Function:

* The directory `oidc_server` contains a Firebase Functions project. Ensure this directory has a `package.json` with `firebase-functions` and `firebase-admin` dependencies (and others like `oidc-provider`, `express`, etc.). It may also contain an `index.js` (or `.ts` if using TypeScript) exporting the function.
* The Firebase configuration files (`firebase.json` and `.firebaserc`) in the repository’s root should reference this function. For example, in `firebase.json`:

  ```json
  {
    "functions": {
      "source": "oidc_server", 
      "runtime": "node14" 
    },
    "hosting": { ... }
  }
  ```

  The `"source": "oidc_server"` tells Firebase CLI to look in that directory for the function code. The `.firebaserc` will contain your Firebase project ID alias.
* **Deploying Manually:** Once you have built the code (if using TypeScript, run `npm run build` to compile to JavaScript), you can deploy via Firebase CLI:

  ```bash
  firebase deploy --only functions:oidc
  ```

  This deploys only the function named “oidc”. If you have just one function, `--only functions` is enough.
* **Firebase Hosting (Optional for OIDC)**: If you prefer to serve the OIDC endpoints on a custom domain or alongside the SPA, you can use Firebase Hosting **rewrites**. For example, you could configure:

  ```json
  "hosting": {
    "rewrites": [
      { "source": "/oidc/**", "function": "oidc" },
      { "source": "/.well-known/openid-configuration", "function": "oidc" }
    ]
  }
  ```

  This will forward requests to `/oidc/*` paths and the well-known discovery URL to the Cloud Function. This way, your issuer could be `https://<your-project>.web.app/oidc` (if you use the web.app domain or a custom domain). Make sure the `issuer` in the provider config matches the domain + path you choose.
* **Testing Endpoints:** After deployment, test the endpoints:

  * `GET https://<YOUR_DOMAIN>/oidc/.well-known/openid-configuration` should return the discovery JSON (check that URLs for authorization, token, JWKS, etc., look correct).
  * `GET https://<YOUR_DOMAIN>/oidc/.well-known/jwks.json` should return your JWKS with public keys (if using static JWKS).
  * Other endpoints like `/oidc/auth` (authorization endpoint), `/oidc/token`, and `/oidc/userinfo` will be used via the SPA or Postman.

### Using Firebase Authentication as Identity Backend

One major advantage of this setup is leveraging Firebase Authentication’s user management while exposing a standards-compliant OIDC interface. Here’s how the integration works and what to configure:

* **Firebase Auth Settings:** In your Firebase project, enable the sign-in methods you plan to support. For example, enable **Email/Password** authentication in the Firebase Console (under **Authentication > Sign-in method** tab) if you want users to log in with email/password via the OIDC provider. You can also enable providers like Google, etc., but those might be redundant if you’re building an IdP (you could directly use them in Firebase Auth).

* **Creating Users:** Use the Firebase Console or Admin SDK to pre-create users (or allow sign-up through some flow). The OIDC provider as implemented here does not itself handle user registration; it assumes the user already exists in Firebase Auth (or you could add a registration endpoint if desired).

* **Custom Login Page:** When a user initiates the OAuth/OIDC flow (e.g., the SPA redirects the user to the authorization endpoint `/authorize`), the OIDC server needs to authenticate the user. There are a couple of ways to handle this:

  1. **Use oidc-provider’s interactions:** The library can present a default login page (if `features.devInteractions` is enabled). This is useful for testing but not suitable for production (it’s very basic). You can customize the interaction to render your own HTML form by disabling devInteractions and using the `interaction` policy. In the custom interaction, you would display a form asking for email and password.
  2. **Firebase Auth verification:** When the user submits their credentials to the OIDC server (e.g., to a route like `/interaction/:uid/login`), use Firebase to verify them:

     * Call Firebase Authentication’s REST API to **sign in with email and password**. This requires the Firebase Web API Key. You can find this in your Firebase project settings (under Web App configuration). The OIDC server can have this API key in its config (e.g., as an env variable). Using a REST call to `accounts:signInWithPassword` will return a Firebase ID Token (JWT) if successful. This ID Token is not directly used as the OIDC token, but it confirms the credentials are correct. You can decode it or use Admin SDK to get the user’s UID and profile info.

       * **Security:** The API key is not considered a secret (it’s used in client-side code typically), so calling this endpoint from your server is fine. Just ensure you use HTTPS.
     * If the sign-in API call returns an error (invalid password, etc.), you know authentication failed and you should return an error on the OIDC login page.
     * If successful, you have the user’s Firebase token or at least the user’s UID. Use that UID to complete the OIDC login:

       * Create an account session in `oidc-provider` for that UID. For example, in your interaction handler: `await provider.interactionFinished(req, res, { login: { account: uid } }, { mergeWithLastSubmission: false });` This tells the OIDC server that the user with identifier `uid` has logged in.
       * The `findAccount` method (as shown earlier) should be able to find this `uid` and provide claims.
       * After calling `interactionFinished`, the OIDC provider will redirect back to the client (SPA) with the authorization code.
  3. **Alternate approach – Firebase Custom Tokens:** Another method (though more roundabout) is to have the user authenticate against Firebase (for example, the SPA could use the Firebase SDK to log in the user, get a Firebase ID token, and then call a special OIDC endpoint to exchange it for an OIDC code or token). This would be a non-standard flow and require custom endpoints, so the above approach (direct email/password in the OIDC provider) is more straightforward for an IdP.

* **Claims in Tokens:** The OIDC ID Token can include custom claims from Firebase:

  * The subject (`sub`) claim should be a unique identifier for the user. Using the Firebase UID is a good choice for `sub`.
  * Include the user’s email (`email`) and whether it’s verified (`email_verified`) from `userRecord.emailVerified`.
  * You could include `name` (from displayName or email prefix) and any other profile info you have.
  * Firebase UID can also be included as a custom claim (or you could use it directly as `sub` as mentioned).
  * If you need to include Firebase-specific claims (like roles or custom claims you set via admin), you could fetch those via `userRecord.customClaims`.

* **UserInfo Endpoint Implementation:** The `oidc-provider` library will handle the `/userinfo` endpoint, but you need to ensure it has the data to return. By setting up `findAccount` and the account’s `claims()` method as above, `oidc-provider` will call it when userinfo is requested. It will include any claim values returned for the scopes the token has. For example, if the ID token was issued with scope `openid email profile`, and your configuration maps `email` scope to the `email` and `email_verified` claims, and `profile` scope to `name`, etc., then those will be returned by userinfo. (In our earlier configuration snippet, we did not explicitly list `claims` mapping, but we could:

  ```js
  claims: {
    email: ['email', 'email_verified'],
    profile: ['name']
  }
  ```

  And ensure the token has scope `"openid email profile"`.)

* **Testing Authentication:** Once deployed, you can test the login flow:

  * Navigate to the authorization endpoint in a browser: `https://<YOUR_DOMAIN>/oidc/auth?response_type=code&client_id=oidc_ui_tester&redirect_uri=http://localhost:3000/callback&scope=openid%20email%20profile%20offline_access&code_challenge_method=S256&code_challenge=<challenge>` where `<challenge>` is a base64url-encoded SHA256 of a code verifier (since we require PKCE). You’ll see the login screen from `oidc-provider` or your custom page. Try logging in with a Firebase user’s credentials. On success, it should redirect to the SPA’s callback URL with a `code` parameter.
  * If you cannot or do not want to manually craft the URL, you will usually rely on the SPA to initiate this redirect (which we will cover in the next section).
  * Check the Firebase logs (or functions logs) if login fails to debug any issues (e.g., wrong API key, etc.).

### Codex Prompt – Generate OIDC Server Code

If you want to use OpenAI’s Codex to scaffold the OIDC server, you can prompt it to generate a starting point for the code. Below is an example **Codex prompt** that describes the requirements and asks for a code generation. You can copy this prompt into a GPT-4 (with code) or Codex-enabled environment to get a head start on the implementation:

```text
Use Node.js (CommonJS) to create an OIDC Provider server with the following requirements:
- Use the `oidc-provider` npm library to set up an OpenID Connect provider.
- The server will run as a Firebase Cloud Function (HTTPS trigger).
- Integrate with Firebase Authentication as the user database:
  - Initialize the Firebase Admin SDK (no credentials needed, assume it runs in Firebase).
  - Implement `findAccount()` such that it retrieves user info from Firebase Auth by UID.
  - Provide a custom login interaction: accept email and password, verify using Firebase Auth's REST API (signInWithPassword).
- The OIDC issuer URL should be configurable (e.g., from an environment variable `OIDC_ISSUER`).
- Use a static signing key for tokens (you can generate an RSA key and use it in JWKS).
- Support the Authorization Code flow with PKCE (no client secret) and Refresh Tokens.
- Configure one client (client_id: "oidc_ui_tester") with redirect URIs for localhost and production, grant type "authorization_code", and no client secret.
- Enable CORS for the token and userinfo endpoints so that a SPA on a different domain can access them.
- Use Express to handle HTTP and mount the oidc-provider on the root path.
- Finally, export the Express app as a Firebase Function (e.g., `exports.oidc = functions.https.onRequest(app)`).

Provide the complete `index.js` (or equivalent) code implementing this.
```

*After running the above prompt, review and test the generated code. You will likely need to adjust configuration details (like adding your own keys, API key for Firebase Auth REST calls, etc.), but this prompt should yield a solid foundation for the OIDC server.*

---

## SPA OIDC Client Tester (`oidc_ui_tester`)

The `oidc_ui_tester` is a **React.js** single-page application that acts as an example client for the OIDC provider. Its purpose is to demonstrate and test the end-to-end login flow. It will allow you (as a developer or tester) to trigger the OIDC login, see the tokens issued, refresh them, and log out. This is extremely useful for ensuring your OIDC provider is working correctly and for demonstrating the flow to others.

### Features and Libraries

* **React + Create React App (CRA):** The project is bootstrapped with Create React App (or a similar setup), providing a development server, build scripts, etc. You’ll find the source in the `src/` directory and can run it with `npm start`.
* **OIDC Client Library:** We recommend using [`oidc-client-ts`](https://github.com/authts/oidc-client-ts) (a maintained fork of the popular `oidc-client` library) to handle the complexities of OIDC in the browser. This library manages constructing the authorization URL, processing the redirect callback, storing tokens, and even silent renewals.
* **PKCE and No Secret:** The SPA will use the Authorization Code flow with PKCE, meaning it does not use a client secret (public client). The library will automatically generate the PKCE code verifier and challenge for you when initiating a login.
* **Functionalities:**

  * **Login:** Redirect the user to the OIDC provider for authentication.
  * **Callback Handling:** After redirect back, process the authorization code to retrieve tokens.
  * **Display Tokens:** Show the ID token (JWT), Access Token, Refresh Token (if any), and possibly the decoded contents of the ID token (claims).
  * **Refresh Tokens:** If a refresh token is available (from including `offline_access` scope), allow the user to request a new Access Token/ID Token using it. This can be done either automatically via the library or manually by calling the token endpoint.
  * **UserInfo:** Optionally, call the UserInfo endpoint with the Access Token to display additional user info (though often ID token contains similar info).
  * **Logout:** End the session – both on the client side (clearing tokens) and potentially initiating OIDC logout so that the provider clears its session. The `oidc-client-ts` library supports `signoutRedirect` for OIDC logout if the provider has a logout endpoint.
* **CORS and Redirects:** Ensure the OIDC provider is configured to allow the SPA’s origin for any direct AJAX calls. Typically:

  * The authorization request is a full-page redirect (no CORS issue).
  * The token request (exchanging code for tokens) is done by the SPA via a back-channel call (XHR/fetch). This **requires CORS** on the token endpoint. We enabled that in our OIDC server express setup for the domain of the SPA.
  * The userinfo request is an XHR and also needs CORS.
  * The refresh token request (if done via XHR) also needs CORS. (If using the library’s silent renew with an iframe, it might not require CORS because it uses an iframe with redirect, but in our simple tester we might do it via XHR for transparency.)

### Configuration (Client ID, Redirect URIs, CORS)

Before running the SPA, a few configuration points must be set:

* **OIDC Settings:** In the React app, you will either use a configuration object for `oidc-client-ts` or environment variables. Important fields:

  * `authority`: The issuer URL of your OIDC provider (the same as configured earlier). For example, `https://<YOUR_DOMAIN>/oidc` (or the Cloud Function URL). The library will append `/.well-known/openid-configuration` to this to discover endpoints.
  * `client_id`: The client identifier you configured in the OIDC server (e.g., `"oidc_ui_tester"`).
  * `redirect_uri`: The URL in the SPA that will handle the OAuth callback. In development, maybe `http://localhost:3000/callback`. In production, perhaps `https://<YOUR_PROJECT>.web.app/callback` or your custom domain equivalent. This must exactly match one of the URIs in the OIDC server’s client config.
  * `post_logout_redirect_uri`: (Optional) URL to redirect to after logout. For example, the homepage of the SPA.
  * `response_type`: `"code"` for code flow.
  * `scope`: `"openid profile email offline_access"` – include `offline_access` if you want a refresh token.
  * `automaticSilentRenew`: (Optional) If true, the library will attempt to renew tokens automatically in the background before they expire, using a hidden iframe. This requires setting up a `silent_redirect_uri` as well. For our tester, you can also handle refresh manually.
* **Environment Variables (React):** Create React App allows defining environment variables prefixed with `REACT_APP_`. For example, you might have a `.env` or `.env.local` with:

  ```
  REACT_APP_OIDC_AUTHORITY=https://<YOUR_DOMAIN>/oidc
  REACT_APP_OIDC_CLIENT_ID=oidc_ui_tester
  REACT_APP_OIDC_REDIRECT_URI=http://localhost:3000/callback
  REACT_APP_OIDC_POST_LOGOUT_URI=http://localhost:3000/
  ```

  These can then be read in your code via `process.env.REACT_APP_OIDC_AUTHORITY`, etc.
  For production (Firebase Hosting), you’d configure the appropriate environment, or simply hardcode them if they are not sensitive (client ID, URLs are not secrets).
* **CORS:** As mentioned, ensure the OIDC server’s CORS config allows your dev origin (`http://localhost:3000`) and production origin. We set this in the server code. If you add more domains or use a custom domain for hosting, update accordingly.
* **Firebase Hosting Redirects for SPA:** When deploying the React app to Firebase Hosting, we need to ensure that client-side routes work. For example, the `/callback` route (or any other path in the React app) should serve `index.html` (the React app entry) so that the React router can handle it. In `firebase.json` under hosting, include:

  ```json
  "hosting": {
    "public": "oidc_ui_tester/build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/callback", "destination": "/index.html" },
      { "source": "/**", "destination": "/index.html" }
    ]
  }
  ```

  The above ensures that any path will load the SPA. The explicit `/callback` rewrite is not strictly needed if you have the catch-all `/**` pointing to `index.html`, but it documents that `/callback` is expected. If you choose to serve the OIDC provider on the same domain and path (via rewrites), ensure those paths are excluded from being rewritten to the SPA. For instance, if using `/oidc/**` for OIDC, you might place that rewrite *before* the SPA rewrite so those requests go to the function.
* **Running Locally:** During development, run the React dev server:

  ```bash
  cd oidc_ui_tester
  npm install
  npm start
  ```

  This will start the app on `http://localhost:3000`. Ensure your OIDC server (perhaps running via emulator or a deployed dev instance) is accessible and the `authority` URL is correct (maybe pointing to a deployed function, or you can run the function locally with `firebase emulators:start` and use that URL).
* **Login Flow:** In the running app, you should have a **Login** button (or similar). When clicked, it will trigger the `UserManager.signinRedirect()` (if using oidc-client). The browser will redirect to the OIDC provider. After successful login and redirect back to `/callback`, the app should handle the callback:

  * Typically, you’d create a React component for the `/callback` route. In its `useEffect`, call `userManager.signinRedirectCallback()` to process the incoming code. This will retrieve the tokens and store them.
  * After processing, you can redirect the user to the home or dashboard page.
* **Display and Refresh:** Once logged in, the app should show the ID token (usually as a JWT string) and possibly decode it to show the claims (for demonstration). It should also show the access token and refresh token (if present). A **Refresh** button can call `userManager.signinSilent()` or directly invoke `userManager.getUser().refresh_token` via a manual fetch:

  * Using the library’s `signinSilent` requires configuration of a `silent_redirect_uri` page (an empty page that calls `userManager.signinSilentCallback()`).
  * For simplicity, you might instead do a fetch to the `/token` endpoint with `grant_type=refresh_token` when the user clicks refresh. (However, storing client secrets or making token calls from JS is sensitive. Since this is a dev tester app, it’s okay, but in production SPA, silent renew via iframe or using refresh token with short expiration tokens is recommended.)
  * You can use the library’s built-in method for renewing as well, which handles it more securely.
* **Logout:** Using `userManager.signoutRedirect()` will redirect the user to the OIDC provider’s end session endpoint (if configured). Ensure your OIDC server has `revocation` or `endSession` enabled if you want to test that. Alternatively, you can simply clear the user from the `UserManager` (remove local tokens) to simulate logout in the SPA. The OIDC provider session (if any) might remain until it expires or a logout endpoint is called.

### Running the SPA and Firebase Hosting Setup

**Development Mode:** As described, run `npm start`. The app will be available at `localhost:3000`. Because our OIDC provider likely runs on a different origin (like cloudfunctions.net or web.app), CORS must be configured (which we did). Also, some browsers might block the third-party cookies or storage required for `oidc-client` when using a Cloud Functions domain due to lacking SameSite=None cookies or similar; using a custom domain or the web.app domain via rewrite can mitigate that.

**Build and Deployment:** To deploy the SPA to Firebase Hosting (for production or staging):

* Ensure `firebase.json` has the hosting configuration with the correct `public` directory (the production build output of your React app, typically `oidc_ui_tester/build`).
* Run the build:

  ```bash
  cd oidc_ui_tester
  npm run build
  ```

  This creates an optimized production build in `oidc_ui_tester/build`.
* Deploy to Firebase Hosting:

  ```bash
  firebase deploy --only hosting
  ```

  This will upload the files to Firebase and make your app available at your Firebase Hosting URL (or custom domain if configured).
* After deployment, test the hosted app:

  * Navigate to the hosting URL (e.g., `https://<your-project>.web.app`). The app should load.
  * Click the Login button, you should be redirected to the OIDC provider (which might still be on a different domain unless you set up rewrites).
  * Complete login and ensure you’re returned to the app and the tokens display correctly.

**Troubleshooting Tips:**

* If the app does not redirect back or you get an error in the console like “No state in storage” or “Invalid state”, it may be due to the app reloading from scratch and losing in-memory state. Ensure you are using the library’s built-in state handling (it should use sessionStorage to store a state between redirects). Also ensure the callback URL in the OIDC server exactly matches the one in the app and OIDC config.
* If you get CORS errors when the app tries to exchange the code for tokens or call userinfo, check that the OIDC server’s responses include the header `Access-Control-Allow-Origin` for the app’s origin. In development, you might want to allow `*` for simplicity. We used the `cors` middleware in the server code for key routes.
* If refresh token is not returned by the OIDC server, check that:

  * You included `offline_access` in the scope.
  * The client in OIDC server is allowed to get refresh tokens (in `oidc-provider`, refresh tokens are enabled via the feature flag and by using the code flow).
  * By default, `oidc-provider` issues refresh tokens only if offline\_access scope is present and certain conditions are met (like `consent` prompt). For testing, you can configure it to always issue or bypass consent if needed.
* If using a custom domain or emulator, update the OIDC client config accordingly. Mismatch between the authority URL and actual URL will cause discovery or token errors.

### Codex Prompt – Generate OIDC SPA Client Code

You can also leverage AI assistance to scaffold the React OIDC client. Below is a prompt you can use with Codex or GPT-4 to generate a starting point for the SPA:

```text
Create a simple React single-page application that demonstrates an OpenID Connect login flow:
- Use the `oidc-client-ts` library to handle the OIDC flow (authorization code with PKCE).
- The app should have a "Login" button that initiates the login redirect.
- After login, it should handle the redirect callback and display the user's tokens (ID token, access token, refresh token).
- Provide a "Refresh Token" button to exchange the refresh token for new tokens, and update the display.
- Provide a "Logout" button to clear the session (and optionally redirect to OIDC provider logout).
- Use React functional components and hooks. For example:
  - An `AuthProvider` context or simple state to hold the User (from oidc-client).
  - A `LoginPage` or `HomePage` component with login/logout buttons.
  - A `CallbackPage` component at route `/callback` that processes the login response.
- The OIDC configuration (authority URL, client_id, redirect_uri) should be defined at the top of the file for now (constants or read from `process.env`).
- Assume the OIDC provider is already running at `process.env.REACT_APP_OIDC_AUTHORITY`.
- After successful login, parse the ID token (JWT) and display some claims (like subject and email).

Provide the code for a minimal React app (could be a single file or a few components) fulfilling these requirements.
```

Running this prompt should give you React code that uses the `oidc-client-ts` (or `oidc-client`) library. You will need to integrate it into the CRA structure (e.g., put the code into `App.js` or create appropriate files). Remember to install the library (`npm install oidc-client-ts`) and to set up your environment variables for the URLs and IDs.

---

## Postman Test Collection (`oidc_postman`)

The `oidc_postman` directory contains a Postman collection (exported as a JSON file, e.g., `OIDC_Firebase_Test.postman_collection.json`) that can be used to manually test the OIDC provider’s endpoints. This is useful for verifying the server’s behavior without the SPA, and for debugging token responses, refresh logic, and the userinfo data.

### Included Requests and Flow

The Postman collection is configured to test the typical OAuth 2.0 Authorization Code with PKCE flow in a step-by-step manner:

1. **Authorization Code Request (Browser Step – Manual):** *This is not an automated Postman request*, but the collection documentation will likely instruct you how to perform this step. It involves directing a browser to the OIDC provider’s authorization endpoint to obtain an authorization code. For example:

   ```
   GET {{OIDC_BASE_URL}}/auth
       ?client_id={{CLIENT_ID}}
       &redirect_uri={{REDIRECT_URI}}
       &response_type=code
       &scope=openid profile email offline_access
       &code_challenge_method=S256
       &code_challenge={{CODE_CHALLENGE}}
   ```

   Because this step requires user interaction (to login), Postman can’t fully automate it. The collection will expect you to do this manually:

   * Open a browser, navigate to a URL constructed as above (the collection may provide an easily copyable example).
   * Complete the login on the OIDC provider’s page.
   * The provider will redirect to the given `redirect_uri` with a `code` (and `state`).
   * Copy the `code` from the URL you were redirected to, and paste it into a Postman environment variable (e.g., `AUTH_CODE`).
   * Also, since PKCE is used, you need the `code_verifier` that corresponds to the `code_challenge`. If the collection is well-crafted, it may generate a code verifier for you in a pre-request script and display it. If not, you should generate a random code verifier string (e.g., 43-128 chars) and compute its SHA256 base64url encoding to use as the challenge. (Some online tools or scripts can do this. For simplicity, the collection might allow a plaintext challenge method or include a script.)
   * Set the code verifier value in the environment as well (e.g., `CODE_VERIFIER`).
2. **Token Exchange (Authorization Code -> Tokens):** This is a POST request in the collection, e.g., **`Exchange Code for Token`**:

   * Method: POST
   * URL: `{{OIDC_BASE_URL}}/token` (for example, `https://<project>.cloudfunctions.net/oidc/token` or via hosting domain)
   * Body: Form URL Encoded:

     * `grant_type`: `authorization_code`
     * `client_id`: `{{CLIENT_ID}}` (if using PKCE with no client secret, the client\_id must still be sent in body or as basic auth according to spec; `oidc-provider` will accept it in body if no secret and auth method none).
     * `redirect_uri`: `{{REDIRECT_URI}}` (must match exactly what was used in step 1)
     * `code`: `{{AUTH_CODE}}` (the code you obtained and set in env)
     * `code_verifier`: `{{CODE_VERIFIER}}` (the plaintext verifier string that matches the challenge)
   * This request will return a JSON payload containing `access_token`, `id_token`, `refresh_token` (if offline\_access was in scope), `token_type`, and `expires_in`.
   * The Postman collection likely has a test script associated with this request that **saves the tokens to environment variables** for use in subsequent requests. For example:

     ```js
     let json = pm.response.json();
     pm.environment.set("ACCESS_TOKEN", json.access_token);
     pm.environment.set("ID_TOKEN", json.id_token);
     pm.environment.set("REFRESH_TOKEN", json.refresh_token);
     ```

     This way, the next requests can use these values.
3. **UserInfo Endpoint:** There will be a GET request, **`UserInfo`**, which calls `{{OIDC_BASE_URL}}/me` or `/userinfo` (depending on the configured path, `oidc-provider` default is `/me` alias for `/userinfo`).

   * This request should include an Authorization header: `Bearer {{ACCESS_TOKEN}}`. The collection likely sets this header automatically using the `ACCESS_TOKEN` environment variable.
   * On success, the response will be a JSON of user claims (e.g., sub, email, etc.). You can verify it matches the ID token’s claims.
   * If the token is missing or expired, you’d get a 401/403 error.
4. **Refresh Token Exchange:** If a refresh token was issued, the collection includes a **`Refresh Token`** request:

   * Method: POST
   * URL: `{{OIDC_BASE_URL}}/token` (same endpoint as step 2, but different body)
   * Body: Form URL Encoded:

     * `grant_type`: `refresh_token`
     * `client_id`: `{{CLIENT_ID}}` (again include client if no secret)
     * `refresh_token`: `{{REFRESH_TOKEN}}`
   * This will return a new `access_token` and possibly a new `id_token` (depending on OIDC provider settings). It may or may not issue a new `refresh_token` (some providers rotate them).
   * The collection’s test script would then update the `ACCESS_TOKEN` (and `ID_TOKEN` if provided, and possibly `REFRESH_TOKEN`) in the environment.
   * You can then call the **UserInfo** request again (or any resource that requires a token) to verify the new access token works. Or decode the new ID token to see if it’s updated.
5. **(Optional) Introspection or Revocation:** The question didn’t explicitly list introspection or revocation, but they enabled these features in the server config snippet example. The collection could include calls to an introspection endpoint or revocation endpoint if those are exposed. However, since it wasn’t requested, we’ll assume only the main three above are needed.
6. **Manual Testing Notes:** The collection documentation or the README should instruct how to use it (see next section).

### Using the Postman Collection

To use the Postman collection for testing your OIDC provider:

* **Import the Collection:** In Postman, click “Import” and select the JSON file from the `oidc_postman` directory (or drag-and-drop it). It should add a new collection, e.g., “OIDC Firebase Provider Tests”, containing the requests.
* **Set Up Environment:** The collection likely comes with an accompanying Postman Environment (a JSON file for environment) or you can create one. This environment should have the following variables:

  * `OIDC_BASE_URL` – Base URL of your OIDC server (without trailing slash). For example, `https://us-central1-<project>.cloudfunctions.net/oidc` or `https://<your-project>.web.app/oidc` depending on how you have set it up.
  * `CLIENT_ID` – The client ID registered (should match what the server expects, e.g., `oidc_ui_tester`).
  * `REDIRECT_URI` – The redirect URI you will use for manual code retrieval. If you have a web page you can use for this (like the SPA’s callback or a static page that just shows the code), you can use that. If not, you can use a dummy scheme like `http://localhost:port` and capture it via a local server or manually from the browser’s address bar. The key is it must be one of the allowed redirect URIs for the client.
  * `AUTH_CODE` – Initialize empty. You will fill this in after the auth step.
  * `CODE_VERIFIER` – Optionally, prepare a value here if using PKCE. If the collection’s first step doesn’t generate one, you can manually generate a random string (e.g., using a tool or script) and compute the challenge. Alternatively, if you set `CODE_VERIFIER`, you can also compute `CODE_CHALLENGE` (see next variable).
  * `CODE_CHALLENGE` – Some collections might ask for this. If a pre-script is present, it might fill these automatically. If doing manually:

    * Choose a random code verifier (e.g., a 43-character string of letters/numbers).
    * Compute the SHA-256 hash, then base64-url encode it (Postman’s pre-request script can do this in JavaScript).
    * Set that as `CODE_CHALLENGE`.
    * Use S256 method in the auth request.
  * `ACCESS_TOKEN`, `ID_TOKEN`, `REFRESH_TOKEN` – Initialize these empty. They will be populated by the collection’s tests after the token request.
* **Authorization (Getting the Code):** As detailed above, perform the login:

  * In Postman, you might find a request or a step labeled “**Authorize**” with the GET URL. You can’t directly get a token by sending this from Postman because it requires redirection and login. Instead, copy the URL (Postman often shows a **Preview Request** or you can construct it by substituting variables).
  * Open that URL in your web browser. It should hit your OIDC provider and show the login. Log in with a valid user.
  * After successful login, you’ll be redirected to the `redirect_uri`. If that URI is something like `http://localhost:3000/callback` and you don’t have a server running there, you will simply see the browser try to load a page and possibly fail – but the URL will contain `?code=<the_code>&state=<...>`.
  * Copy the `code` value from the URL. Paste this value into your Postman environment’s `AUTH_CODE`.
  * If you had to generate a code challenge manually, ensure the `CODE_VERIFIER` in Postman env is the correct one for that code (i.e., the one whose hash you used).
  * Now you’re ready to exchange the code.
* **Token Request:** Send the **“Exchange Code for Token”** request in Postman. It should return 200 OK and a JSON body with tokens. The test script should automatically save `ACCESS_TOKEN`, `ID_TOKEN`, `REFRESH_TOKEN` to the environment.

  * Verify in the Postman environment (eye icon) that those variables are now set.
  * You can also copy the ID Token and decode it on [jwt.io](https://jwt.io) or another JWT decoder to ensure the claims (iss, aud, sub, email, etc.) are as expected.
* **UserInfo:** Send the **“UserInfo”** request. It should return a JSON of user claims. If you included `email` and `profile` in scopes, you should see those in the output. It might look like:

  ```json
  {
    "sub": "firebase-uid-12345",
    "email": "user@example.com",
    "email_verified": true,
    "name": "John Doe"
  }
  ```

  Compare this with the ID token’s payload for consistency.
* **Refresh Token:** To test refresh, ensure you **have** a refresh token (if not, revisit the scope and client config; by design offline\_access is needed). Then send **“Refresh Token”** request. If all is well, you get a similar response JSON with a new access token and possibly a new id token.

  * The environment will update the tokens. You can compare the new ID token’s payload with the old one (they might have a new issue time).
  * After refreshing, try the UserInfo request again (it should still work). Or if you want, you can also try using the old access token after it’s expired (you’d have to wait until expiry or manually change the `ACCESS_TOKEN` env to an old value) to see that it fails and the new one works.
* **Error Testing:** You can also simulate error scenarios:

  * Use an invalid code or code\_verifier to ensure the token endpoint returns an error.
  * Omit required fields to see error responses (for learning purposes).
  * Try the token exchange twice with the same code (the second should fail, since code should be one-time use).
* **Automation vs Manual:** Note that parts of this flow are manual. Postman does have an OAuth 2.0 helper that could handle PKCE automatically (you can configure an OAuth2 auth in Postman with PKCE and it will open a browser window for you). However, since we are providing a collection, we assume a semi-manual approach. The collection’s documentation (or this README) guides the user through the steps.

Remember to **securely handle the tokens** during testing; don’t share the refresh token or ID token publicly as they grant access to the user’s session. In a real scenario, these should be kept confidential.

After testing, you can revoke tokens or delete test users from Firebase if needed.

### Codex Prompt – Generate Postman Collection JSON

While it’s unusual to use Codex to generate a Postman collection (as it’s a specific JSON structure), you can still attempt it if you want to automate or customize the collection. Generally, one would manually create the collection in Postman. However, for completeness, here’s a possible prompt you could use to have an AI generate a Postman collection structure:

```text
Generate a Postman collection in JSON format for testing an OpenID Connect Provider. Include the following requests:
1. **Exchange Code for Token** – POST request to `{{OIDC_BASE_URL}}/token` with body x-www-form-urlencoded containing:
   - `grant_type`: `authorization_code`
   - `client_id`: `{{CLIENT_ID}}`
   - `code`: `{{AUTH_CODE}}`
   - `redirect_uri`: `{{REDIRECT_URI}}`
   - `code_verifier`: `{{CODE_VERIFIER}}`
   This request should save `access_token`, `id_token`, and `refresh_token` to environment variables upon success.
2. **UserInfo** – GET request to `{{OIDC_BASE_URL}}/userinfo` with an Authorization header `Bearer {{ACCESS_TOKEN}}`.
3. **Refresh Token** – POST request to `{{OIDC_BASE_URL}}/token` with body containing:
   - `grant_type`: `refresh_token`
   - `client_id`: `{{CLIENT_ID}}`
   - `refresh_token`: `{{REFRESH_TOKEN}}`
   This should update the `access_token` (and `id_token` if present) in the environment.
Include an introductory description in the collection documentation on how to obtain the authorization code manually (by visiting the authorization URL in a browser) and setting the `AUTH_CODE` and `CODE_VERIFIER` in the environment before running the collection.
Provide the output as a JSON structure compatible with Postman collection import.
```

This prompt asks the AI to produce a JSON, which would be the collection export. You might need to adjust the details (IDs, etc.) after generation. In practice, it might be easier to create the collection by hand in Postman, but the AI could help outline the structure or provide a starting JSON that you can modify.

---

## Firebase Project Initialization & Configuration

Before you can deploy or fully test the above components, you need to set up a Firebase project and configure it for Authentication, Functions, and Hosting. Here we outline how to do that:

### Creating and Setting up the Firebase Project

1. **Create a Firebase Project:** If you haven’t already, go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing project if appropriate). Enable Google Analytics if you want (not required for our purposes).
2. **Enable Authentication Providers:** In your Firebase project console, navigate to **Authentication > Sign-in method**. Enable the Email/Password provider (since we plan to use email/password in our OIDC flow). You can also create a few test users under **Users** for login. If you want to allow other methods (phone, Google, etc.), you can enable them as well, but our custom OIDC provider flow primarily handles email/password.
3. **(Optional) Google Cloud Identity Platform:** *Note:* For a production scenario, using **Google Cloud Identity Platform** (GCIP) could allow you to expose OIDC and SAML directly from Firebase Auth, but that is beyond our scope (and requires enabling a paid service). We are implementing our own IdP using Firebase Auth, so GCIP is not required.
4. **Install Firebase CLI:** On your development machine, install the Firebase CLI tool if not already:

   ```bash
   npm install -g firebase-tools
   ```

   Login to Firebase:

   ```bash
   firebase login
   ```
5. **Initialize Firebase in the Repository:** Our repository is structured with subdirectories, so be careful with initialization:

   * We have a single Firebase project that will serve both the Cloud Function and Hosting. Typically, you run `firebase init` at the root of the repository (where `firebase.json` will live).
   * If not already done, run `firebase init`. Select **Functions** and **Hosting** when prompted (you can skip other features unless needed).
   * Functions: when prompted for the functions directory, you can specify `oidc_server` (if the CLI allows custom dir; older CLI versions default to “functions”). Alternatively, accept “functions” then move things manually. E.g., you might initialize, then move the generated `functions/` folder’s content into `oidc_server/`. Ensure `firebase.json` is updated with `"source": "oidc_server"`.
   * Choose JavaScript or TypeScript for functions. (If you choose TypeScript, it will set up tsconfig etc. If using JS, ensure you adjust accordingly. Our example code was in JS for simplicity, but TypeScript is fine too.)
   * Hosting: specify `oidc_ui_tester/build` as the public directory (you can change this later in firebase.json). Configure it as a single-page app (it will ask if you want to rewrite all routes to index.html – answer yes).
   * The CLI may create a default `firebase.json` and `.firebaserc`. The `.firebaserc` will contain your project’s ID. Make sure to choose the correct Firebase project when prompted (or initialize with a new one).
6. **Adjust firebase.json:** If needed, edit `firebase.json` to include:

   * Under `"hosting"`, ensure you have the rewrites for SPA (and possibly OIDC as discussed). For example:

     ```json
     "hosting": {
       "public": "oidc_ui_tester/build",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "/oidc/**",
           "function": "oidc"
         },
         {
           "source": "/.well-known/openid-configuration",
           "function": "oidc"
         },
         {
           "source": "/**",
           "destination": "/index.html"
         }
       ]
     }
     ```

     The above assumes you want to route OIDC requests through hosting. If you plan to use the cloudfunctions.net URL for OIDC, you can omit the specific rewrites for `/oidc` and `.well-known` and just let those hit the function domain. In that case, the hosting rewrites might just be the catch-all for the SPA.
7. **Configure Firebase project ID:** The `.firebaserc` should look like:

   ```json
   {
     "projects": {
       "default": "<your-project-id>"
     }
   }
   ```

   If you have multiple targets (like separate project for dev/prod), you can configure aliases here. For now, ensure the default is set to your project.
8. **Service Account Permissions:** By default, the Cloud Function will use the Firebase project’s default service account, which has permissions to use Firebase Authentication (so Admin SDK calls like `getUser` will work). If you plan to use Firestore (for storing sessions or other data), enable Firestore in the Firebase console and make sure the service account has Firestore access (default editor role covers this).
9. **(Optional) Firestore for Session Storage:** As mentioned, `oidc-provider` can use an adapter for persistent storage. If you find that necessary (e.g., to store authorization codes, sessions, etc., beyond in-memory), you can implement a Firestore adapter. The example from the Russian blog had an adapter in `functions/adapters/firestore.js` which maps OIDC state to Firestore documents. For initial development, the in-memory default adapter might suffice, but be aware it won’t work across multiple function instances or restarts. Consider enabling the built-in `memory` adapter with caution or implementing Firestore adapter for production stability.

### Initializing Firebase Functions and Hosting

After setting up the project and firebase.json, do the following in your project root:

* **Install Dependencies:**

  ```bash
  cd oidc_server
  npm install
  ```

  Make sure you have all required packages: `firebase-functions`, `firebase-admin`, `oidc-provider`, `express`, `cors`, etc., as well as any dev dependencies if using TypeScript (like `typescript`, `tslint` or ESLint).
* **Build Functions (if TypeScript):** If you chose TypeScript or have a build step, run:

  ```bash
  npm run build
  ```

  This compiles TypeScript to `lib/` or similar (the Firebase default TS config outputs to `lib`). Ensure the `main` field in `package.json` points to the compiled file (like `"main": "lib/index.js"`).
* **Emulate or Deploy:**

  * To test locally, you can use the Firebase Emulator Suite. Run:

    ```bash
    firebase emulators:start --only functions,hosting
    ```

    This will spin up a local endpoint for functions (usually at [http://localhost:5001](http://localhost:5001)) and hosting (usually [http://localhost:5000](http://localhost:5000)). If you set up rewrites for /oidc on hosting, you can access e.g. [http://localhost:5000/oidc/.well-known/openid-configuration](http://localhost:5000/oidc/.well-known/openid-configuration). Without hosting, you’d use [http://localhost:5001/](http://localhost:5001/)<project-id>/<region>/oidc.
    The emulator will pick up your functions code. If it fails to load, check the logs for errors. You might need to run `npm run build` for functions if not auto-building.
  * To deploy for the first time:

    ```bash
    firebase deploy --only functions,hosting
    ```

    This will deploy both the cloud function and the hosting site. (Make sure the Firebase project is correctly targeted.)
* **Verify Deployment:** After deploying:

  * Check the Firebase console **Functions** section to see if the function deployed and is running.
  * Check **Hosting** section to see if the site is live. You can open the hosted URL.
  * Test the OIDC discovery: `https://<your-project>.web.app/oidc/.well-known/openid-configuration` (if using hosting rewrites) or `https://us-central1-<project>.cloudfunctions.net/oidc/.well-known/openid-configuration` if directly. This should return JSON. If it’s not working, use `firebase functions:log` to see if requests are hitting the function or check your rewrite rules.

### Local Development and Emulators

During development, you can use the Firebase Emulators to avoid deploying each time:

* **Functions Emulator:** As mentioned, `firebase emulators:start` will run functions locally. If you only change function code, just restart this or use `firebase emulators:start --only functions` to just run functions. The emulator by default uses dummy service account credentials but is connected to your project resources. If you call Admin SDK methods (like getUser), it will attempt to use your project’s data. **Important:** The Auth Emulator (if enabled) is separate from your real Firebase Auth, so by default `admin.auth().getUser()` might not find users unless you enable the Auth emulator and create users there. To keep things simple, you might skip the Auth emulator and let admin SDK actually talk to real Firebase Auth (this requires the emulator to have credentials; by default it might not if not provided).

  * A workaround is to provide your service account key locally. Set environment variable `GOOGLE_APPLICATION_CREDENTIALS=<path/to/serviceAccountKey.json>` before starting the emulator. This will let admin SDK talk to real Firebase Auth.
  * Alternatively, create some test users in the Auth emulator and call `firebase emulators:start --only auth,functions`. The Admin SDK when running in emulator will detect the Auth emulator via environment variables and possibly operate on it. (Make sure to configure `firebase.json` with an auth emulator entry.)

* **Hosting Emulator & SPA:** You can serve the React app via the emulator as well. If you run the hosting emulator, it will serve the files from `oidc_ui_tester/build`. So you need to build the app first (`npm run build`). During active development, it’s easier to run `npm start` for the SPA (port 3000) and functions emulator (5001) separately. You just need to configure the SPA to talk to the emulator function:

  * Instead of `authority: https://...cloudfunctions.net/oidc`, you would use `http://localhost:5001/<your-project>/us-central1/oidc` (the exact emulator URL; check emulator output for the function URL). CORS should allow localhost due to our setup.
  * This way, you can iterate on the function and SPA quickly.
  * Once things look good, do a final build and test with the hosting emulator or deploy.

* **Using .env for Emulator Config:** Firebase Functions now supports loading `.env` files for environment config in emulators. For example, if you put `API_KEY=XXXXX` in `oidc_server/.env`, you can access it via `process.env.API_KEY`. You might store your Firebase API key for the Auth REST API there, or other config like default issuer, etc., for local testing. Just be careful not to commit secrets. (The Firebase CLI by default ignores `.env` files from upload, but double-check `.firebaseignore`).

* **Seeding Data:** If you need some initial clients in Firestore (if you used Firestore for dynamic client registration as in the blog example), you can pre-create them. But in our static config approach, it’s not needed.

Now you have a fully set up environment to develop and test both components locally and deploy them.

## Configuration Management & Environment Secrets

Managing configuration and secrets is important for both local development and in CI/CD. Here’s how to handle them for this project:

### Environment Variables for OIDC Server

The OIDC server may require several configuration values that differ between environments (development, production):

* **Issuer URL:** As discussed, the issuer is environment-specific (localhost vs production domain). You can use an environment variable like `OIDC_ISSUER`. In Firebase Functions, you can set environment variables via the Firebase CLI or use the config system:

  * **Using Firebase Config:** `firebase functions:config:set oidc.issuer="https://example.com/oidc"` will store it, and in code you access via `functions.config().oidc.issuer`. However, this requires deploying with those configs set. It’s one way to avoid committing the issuer in code.
  * **Using .env file:** In the functions directory, create `.env` with `OIDC_ISSUER=...`. The emulator will load it, and you can also have the CI set it for build if needed.
  * **Hardcode for now:** It’s also acceptable in testing to hardcode the known issuer (since if it’s just one known domain).
* **Firebase API Key:** If you use the REST API for verifying passwords, you need the Firebase Web API Key. Treat this as a configuration value (not exactly a secret, but still environment-specific). It can go in functions config or .env as well (e.g., `FIREBASE_API_KEY`).
* **JWKS / Keys:** If you use a static JWKS, you have a couple of options:

  * Commit a JWKS JSON file in the repo (not a secret since it’s public keys). But you also need the private keys to sign tokens – those should be kept secret. Typically you’d generate a key pair, put the private key in code or an env var. Since Firebase Functions doesn’t have a separate secret manager at this time (aside from using GCP Secret Manager or env), a straightforward approach is to generate a RSA key, encode it (PEM or JWK), and store it in an environment variable. For example, `functions:config:set oidc.private_key="-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----"`. Then load it and use it to initialize the Provider with a keystore.
  * Alternatively, generate the key at startup and store it in Firestore if not present (persist it). But that’s complex for now.
  * The easiest for now: in dev, let the provider generate a fresh key (but accept that tokens invalidation can happen on restart). In prod, do one of the above to persist keys.
* **Other Config:** You might have flags like `DEV_MODE` or other tuning parameters (like token lifetimes) that you want to tweak per environment. These can also be environment variables or config values.
* **Local Emulation:** When running locally, you can set environment variables in your shell or use the `.env` support. For example, to avoid hardcoding the API key in code, you can do:

  ```js
  const apiKey = process.env.FIREBASE_API_KEY;
  // then use it in the REST request URL for signInWithPassword
  ```

  And in `.env` have the actual key.

Make sure **not** to commit real secrets (like any private keys or service account keys) to the repository. Use Firebase config or CI secrets for those.

### Environment Variables for SPA (React)

In the React app, you might want to parameterize things like the OIDC provider URL or client ID:

* With Create React App, any variable starting with `REACT_APP_` in the environment at build time will be embedded.
* Typically for production, you might not have a different URL if using the same Firebase project, but if you had separate dev and prod, or a custom domain vs default domain, you might need to adjust.
* You can have a `.env.development` and `.env.production` in `oidc_ui_tester/` to differentiate local vs production builds.
* For example:

  * `.env.development`:

    ```
    REACT_APP_OIDC_AUTHORITY=http://localhost:5000/oidc   (if using hosting emulator) or cloudfunctions local URL
    REACT_APP_OIDC_CLIENT_ID=oidc_ui_tester
    REACT_APP_OIDC_REDIRECT_URI=http://localhost:3000/callback
    ```
  * `.env.production`:

    ```
    REACT_APP_OIDC_AUTHORITY=https://<your-project>.web.app/oidc   (if using hosting rewrite) or cloudfunctions.net URL
    REACT_APP_OIDC_CLIENT_ID=oidc_ui_tester
    REACT_APP_OIDC_REDIRECT_URI=https://<your-project>.web.app/callback
    ```
* When you run `npm run build`, ensure the correct env is picked up (CRA picks production by default for build, development for start).
* If you need to supply any secret to React (which ideally you don’t, since it’s public), you can’t hide it – it ends up in the JS bundle. So things like API keys (for Firebase or others) are fine, but never put a client secret or any private key here.

### Secure Storage of Secrets

* **Firebase Token (for CI):** We will discuss in the CI/CD section, but this is a secret (essentially like an OAuth token) that should be stored in GitHub Actions secrets, not in code.

* **Service Account JSON:** If you need to use a service account for local development or special cases, treat the JSON key file as sensitive. Do not commit it. Instead, provide it via environment (e.g., set GOOGLE\_APPLICATION\_CREDENTIALS to point to a path outside the repo, or use a secret in CI if needed).

* **OIDC Client Secrets:** In our scenario, we are not using a confidential client, so there’s no client secret to worry about. If you later add one (for some other client), do not commit it; it could be stored in an environment config as well.

* **API Keys and IDs:** These can often be considered configuration. Firebase API keys are not secret, but out of habit treat them with some care (don’t post publicly). If using any third-party API (like an email service or something in functions), those keys should be in functions config or GitHub secrets.

* **GitHub Actions and .env:** If your build or deploy needs certain env vars, you can supply them in the workflow file (e.g., `env:` block, pulling from secrets). For instance, if your functions code expects `process.env.OIDC_ISSUER`, you can set that in the build or deploy step to ensure the code has the correct value (or better, have the code use the Firebase project info to construct it).

We’ll now move to setting up the CI/CD pipelines, which ties into using secrets and environment variables appropriately.

## CI/CD Pipeline Setup (GitHub Actions)

We have two separate deployment targets: the OIDC server (Firebase Functions) and the SPA (Firebase Hosting). We will use **GitHub Actions** to automate the deployment of both whenever changes are pushed to the repository.

We assume the repository is on GitHub and you want to deploy, for example, on push to the main branch or via pull request merges. We will create two workflows: one for functions (`oidc_server`) and one for hosting (`oidc_ui_tester`). This separation can be logical (you might deploy functions more frequently than the UI or vice versa), and it also helps with clarity in logs.

### GitHub Actions Overview

GitHub Actions allows us to define YAML files in `.github/workflows/` directory. Each YAML defines one workflow with triggers (like push events) and a series of jobs composed of steps.

For Firebase deployment, the key requirements are:

* We need the Firebase CLI available in the runner.
* We need to be authenticated with Firebase (using our project).
* We then run `firebase deploy` for the desired targets.
* We don’t want to expose credentials in the repo, so we’ll use a secret for authentication.

### Configuring Firebase Deployment Credentials (FIREBASE\_TOKEN)

Firebase CLI can be authenticated in CI using a **CI token**. This token can be generated with the command:

```bash
firebase login:ci
```

This will produce a long token string. Obtain this by running it locally (it will prompt you to login via browser and then provide the token in the terminal). **Treat this token like a password.** It allows deploying to your Firebase project.

Once you have the token:

* Go to your GitHub repository’s **Settings > Secrets and variables > Actions** (or similar interface for adding secrets).
* Add a new Secret named `FIREBASE_TOKEN` and paste the token value.
* You might also add a `FIREBASE_PROJECT_ID` secret (or just hardcode the project in firebase.json which is simpler). Usually, firebase.json/.firebaserc already knows the project, so not needed explicitly in CI.
* If you have multiple projects (dev/staging/prod), you might store multiple tokens or use the same token if your Firebase user has access to all and specify the project via CLI args or alias.

We will reference `FIREBASE_TOKEN` in our workflows to authenticate the Firebase CLI.

*(Note: Another method is to use the official Firebase GitHub Action or to use Google Cloud service account JSON. Using `firebase-tools` with FIREBASE\_TOKEN is straightforward for most cases.)*

### CI Workflow – Deploy OIDC Server (Functions)

Create a file `.github/workflows/deploy-functions.yml` (for example). Inside, define something like:

```yaml
name: Deploy OIDC Server (Firebase Functions)

on:
  push:
    paths:
      - 'oidc_server/**'       # Trigger when files in oidc_server change
      - 'package.json'         # If root or related config changes 
      - 'firebase.json'        # If firebase config changes
      - '.firebaserc'          
    branches:
      - main                   # Only deploy on pushes to main (adjust as needed)

jobs:
  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'   # Use Node 16 or the version your functions require
          
      - name: Install Functions Dependencies
        working-directory: oidc_server
        run: npm ci

      # (Optional) If using TypeScript or build step for functions:
      - name: Build Functions
        working-directory: oidc_server
        run: npm run build

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy to Firebase Functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
        run: firebase deploy --only functions:oidc --project ${FIREBASE_PROJECT_ID}
```

Let’s break down a few things:

* **Trigger (`on:`):** We set it to push on main and only if files related to the functions changed (to avoid deploying on every commit that maybe only touches frontend). Adjust the paths as needed. The `firebase.json` and `.firebaserc` are included because changes there affect deployment config.
* **Setup Steps:** We check out code, setup Node (the version should match your Firebase Functions node engine).
* **Install Dependencies:** We run `npm ci` in `oidc_server` directory to install exact dependencies (faster than npm install, uses lockfile).
* **Build:** If not using a build (for JS), you can omit it. If TypeScript, this compiles the code.
* **Firebase CLI:** Installing globally for ease of use.
* **Deploy Step:** We use the `firebase deploy` command.

  * `--only functions:oidc` ensures we only deploy that specific function (to avoid disturbing other functions if any). If you have multiple functions or changed function names, adjust accordingly (or you can do `--only functions` to deploy all functions in the source).
  * We pass the `FIREBASE_TOKEN` from secrets to authenticate.
  * `--project ${FIREBASE_PROJECT_ID}`: You can specify the project explicitly. If your `.firebaserc` is set and you don’t provide `--project`, it will use the default from .firebaserc. So this flag can be omitted if .firebaserc is correct. If you have an environment variable for project, you can set that via GH secrets too.
* **Outcome:** On a successful run, your function is deployed. GitHub Actions will show logs, and you can verify the deployment in Firebase console.

**Note:** You might consider adding another job or step to run tests or lint for your functions before deploying, to catch errors. Also, you might want to conditionally run deploy only if tests pass. Those steps are omitted for brevity.

### CI Workflow – Deploy SPA Client (Hosting)

Similarly, create a file e.g. `.github/workflows/deploy-hosting.yml`:

```yaml
name: Deploy OIDC SPA (Firebase Hosting)

on:
  push:
    paths:
      - 'oidc_ui_tester/**'
      - 'firebase.json'
      - '.firebaserc'
    branches:
      - main

jobs:
  deploy-hosting:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      - name: Install Frontend Dependencies
        working-directory: oidc_ui_tester
        run: npm ci

      - name: Build SPA
        working-directory: oidc_ui_tester
        run: npm run build

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy to Firebase Hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
        run: firebase deploy --only hosting --project ${FIREBASE_PROJECT_ID}
```

Explanation:

* Trigger on changes under `oidc_ui_tester` (the React app), also when firebase config files change (since hosting setup could be affected).
* Install dependencies and run the production build for the React app.
* Then deploy hosting. This will deploy all configured hosting sites in firebase.json (which we only have one, the default).
* Again, uses FIREBASE\_TOKEN for auth. The project is specified similarly (optional if .firebaserc is good).

**CORS Note:** Deploying hosting might also deploy the configured rewrites. If you changed rewrites that affect functions, sometimes you might want to deploy both functions and hosting together (to keep things in sync). There are a few approaches:

* Combine into one workflow (deploy both in one go).
* Use one workflow that calls `firebase deploy --only functions,hosting`.
* Or allow each to trigger the other if needed. Simpler: manually ensure if you change something that affects both, push triggers both workflows (they can run in parallel without much issue). If concerned, you can merge them.

For clarity, we keep them separate. But if they run at the same time, one might finish before the other. It’s usually fine because hosting and functions deploy are independent (just be careful if a new UI expects a new function in place or vice versa, deploy the needed one first or combine them).

### Using GitHub Actions Secrets

We already covered adding the `FIREBASE_TOKEN` secret. There might be other secrets:

* If your OIDC server needed a secret key or API key, and you didn’t want to put it in code or config, you could add those as secrets and inject them as environment variables in the workflow. For example, if you had `API_KEY` to set, you could do:

  ```yaml
  env:
    FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
    FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
  run: firebase deploy --only functions
  ```

  And ensure your function code picks up `process.env.FIREBASE_API_KEY`.
* Or you could use `firebase functions:config:set` as part of CI to update config if needed. But usually that’s a separate step or manual, not on every deploy (unless config changes).

The secret we definitely use is the token. Keep that token updated – if it ever gets revoked or expires (shouldn’t expire normally), generate a new one and update the secret.

### Monitoring CI/CD

After pushing changes, check the Actions tab on GitHub to see the workflows running. If a deploy fails:

* You might see Firebase CLI errors. Common ones:

  * Authentication failed (check token).
  * Function deploy error (check build logs or error messages, e.g., syntax error or missing dependency).
  * Hosting deploy error (less common, unless some files are too large or config issue).
* You can always test the same commands locally to debug (e.g., run `firebase deploy` locally with same config).
* If actions succeed but things don’t work live, check that the correct environment was deployed (maybe you deployed to a wrong project if project ID wasn’t right).

The CI/CD setup ensures that the latest code is quickly available on Firebase after each push, reducing manual steps.

### Codex Prompt – Generate GitHub Actions Workflow (Functions)

To have AI help generate or verify the CI YAML, you could use a prompt like:

```text
Generate a GitHub Actions workflow YAML for deploying a Firebase Cloud Function. The repository has a `oidc_server` directory for the function code. We want to:
- Run on pushes to the main branch when files in `oidc_server/**` or firebase config change.
- Use Node.js 16.
- Install dependencies in `oidc_server` and build the project (assume a build step).
- Install Firebase CLI.
- Deploy only the functions (function name "oidc") to Firebase using a FIREBASE_TOKEN secret for authentication.
Provide the YAML configuration.
```

This would yield a YAML similar to what we wrote, which you can then adjust as needed.

### Codex Prompt – Generate GitHub Actions Workflow (Hosting)

Similarly, for the hosting part:

```text
Generate a GitHub Actions workflow YAML for deploying a React app to Firebase Hosting. The app is in `oidc_ui_tester` directory. Requirements:
- Trigger on pushes to main when files in `oidc_ui_tester/**` or firebase config change.
- Use Node.js 16, install dependencies, run `npm run build` in that directory.
- Install Firebase CLI.
- Deploy only the hosting to Firebase (using FIREBASE_TOKEN secret).
Provide the YAML.
```

The result should be close to the deploy-hosting.yml we composed.

---

## Conclusion

With the above setup:

* You have a **custom OpenID Connect server** running on Firebase, leveraging Firebase Auth for user management.
* A **test SPA** that can authenticate via that server and demonstrate obtaining and using tokens.
* A **Postman collection** for direct API-level testing of the OIDC endpoints.
* Automated **CI/CD** processes to deploy updates to both the server and client easily.
* Documentation (this README) to guide through initialization, configuration, and usage.

**Next Steps & Tips:**

* Always test changes in a staging environment or emulator if possible, especially changes to auth logic.
* If scaling up, consider security aspects: e.g., setting secure cookies or state validation in the OIDC server’s interaction, using HTTPS everywhere (Firebase Hosting provides HTTPS by default).
* Monitor your Firebase project’s usage (Cloud Functions invocations, etc.), since an OIDC server could generate significant load if many clients use it.
* Extend the setup as needed: for example, implement a proper user consent page in the OIDC flow if you plan to allow third-party clients, handle token revocation on logout, etc.

Happy coding and authenticating! Enjoy your integrated Firebase OIDC setup.
