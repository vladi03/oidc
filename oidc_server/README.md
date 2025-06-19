# Firebase OIDC Provider

This directory contains a Firebase Cloud Function implementing an OpenID Connect provider using [oidc-provider](https://github.com/panva/node-oidc-provider).

## Setup

Install dependencies and deploy the function:

```bash
cd oidc_server
npm install
firebase deploy --only functions
```

Set the following environment variables when deploying or in your Firebase project settings:

- `OIDC_ISSUER` - the issuer URL exposed by the function.
- `FIREBASE_API_KEY` - API key for your Firebase project (used to verify email/password logins).

## Usage

The function exports an HTTPS endpoint `oidc` which serves the OIDC discovery document, authorization, token and userinfo endpoints. A simple login form is presented that uses Firebase Authentication to verify credentials.
