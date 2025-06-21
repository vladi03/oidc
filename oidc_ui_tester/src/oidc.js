import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

// OIDC configuration. Replace values or use environment variables as needed.
const OIDC_AUTHORITY = "http://localhost:5001/netware-326600/us-central1/oidc";//process.env.REACT_APP_OIDC_AUTHORITY || 'http://localhost:3000';
const CLIENT_ID = 'oidc_ui_tester';//process.env.REACT_APP_OIDC_CLIENT_ID || 'oidc_ui_tester';
const REDIRECT_URI = `${window.location.origin}/callback`;// process.env.REACT_APP_OIDC_REDIRECT_URI || `${window.location.origin}/callback`;

const config = {
  authority: OIDC_AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email offline_access',
  userStore: new WebStorageStateStore({ store: window.localStorage })
};

export const userManager = new UserManager(config);
