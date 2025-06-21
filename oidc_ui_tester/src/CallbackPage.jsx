import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from './oidc';

export default function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      await userManager.signinRedirectCallback();
      navigate('/');
    }
    handleCallback();
  }, [navigate]);

  return <div>Processing login...</div>;
}
