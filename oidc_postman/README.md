# Postman Test Collection

This directory contains a Postman collection for testing the OpenID Connect server.

Import `OIDC_Test.postman_collection.json` into Postman and create an environment containing:

- `OIDC_BASE_URL`
- `CLIENT_ID`
- `REDIRECT_URI`
- `AUTH_CODE`
- `CODE_VERIFIER`
- `ACCESS_TOKEN`
- `ID_TOKEN`
- `REFRESH_TOKEN`

To start, manually visit the authorization URL in a browser to obtain an authorization code. Set `AUTH_CODE` and `CODE_VERIFIER` in the environment, then run the collection requests in order. Tokens returned by the server will be stored back into the environment.
