import React, { useEffect, useState } from 'react';
import { userManager } from './oidc';
import jwtDecode from 'jwt-decode';

export default function App() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    userManager.getUser().then(u => {
      if (u) {
        setUser(u);
        setClaims(parseJwt(u.id_token));
      }
    });
  }, []);

  const parseJwt = token => {
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  };

  const login = () => {
    userManager.signinRedirect();
  };

  const logout = () => {
    userManager.signoutRedirect();
    setUser(null);
    setClaims(null);
  };

  const refreshToken = async () => {
    const refreshed = await userManager.signinSilent();
    setUser(refreshed);
    setClaims(parseJwt(refreshed.id_token));
  };

  if (!user) {
    return (
      <div>
        <h1>React OIDC Tester</h1>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div>
      <h1>React OIDC Tester</h1>
      <p><strong>Access Token:</strong> {user.access_token}</p>
      <p><strong>ID Token:</strong> {user.id_token}</p>
      <p><strong>Refresh Token:</strong> {user.refresh_token}</p>
      {claims && (
        <div>
          <h2>ID Token Claims</h2>
          <pre>{JSON.stringify(claims, null, 2)}</pre>
        </div>
      )}
      <button onClick={refreshToken}>Refresh Token</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
