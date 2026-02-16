/**
 * LoginPage — SSO login with API key fallback.
 */

import { createElement, useState } from 'react';
import { useAuth } from './sso.js';

export function LoginPage() {
  const { loginWithSSO, loginWithApiKey, authEnabled, loading } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return createElement('div', { className: 'fb-login fb-login--loading' }, 'Loading…');
  }

  const handleApiKeySubmit = async (e: Event) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await loginWithApiKey(apiKey.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return createElement(
    'div',
    { className: 'fb-login' },
    createElement('div', { className: 'fb-login__card' },
      createElement('h1', { className: 'fb-login__title' }, 'FormBridge Admin'),

      // SSO button (shown when auth is enabled)
      authEnabled && createElement(
        'button',
        {
          className: 'fb-login__sso-btn',
          onClick: loginWithSSO,
          type: 'button',
        },
        'Sign in with SSO'
      ),

      // Divider
      authEnabled && createElement(
        'div',
        { className: 'fb-login__divider' },
        createElement('span', null, 'or')
      ),

      // API key input (always available as fallback)
      createElement(
        'form',
        { className: 'fb-login__form', onSubmit: handleApiKeySubmit },
        createElement('label', { htmlFor: 'api-key-input' }, 'API Key'),
        createElement('input', {
          id: 'api-key-input',
          type: 'password',
          className: 'fb-login__input',
          placeholder: 'fb_key_...',
          value: apiKey,
          onChange: (e: Event) => setApiKey((e.target as HTMLInputElement).value),
          disabled: submitting,
        }),
        createElement(
          'button',
          {
            type: 'submit',
            className: 'fb-login__submit-btn',
            disabled: submitting || !apiKey.trim(),
          },
          submitting ? 'Signing in…' : 'Sign in with API Key'
        ),
      ),

      // Error message
      error && createElement('div', { className: 'fb-login__error', role: 'alert' }, error),
    )
  );
}
