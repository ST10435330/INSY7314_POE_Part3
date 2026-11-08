import { useState } from 'react';
import { apiRequest } from './api';
import AuthForm from './components/AuthForm.jsx';
import { useAuth } from './hooks/useAuth.js';
import GigList from './components/GigList.jsx';
import FreelancerGigs from './components/FreelancerGigs.jsx';
import AccountActivity from './components/AccountActivity.jsx';

function AccountPanel({ user, request, onLogout }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await onLogout();
    } finally {
      setSigningOut(false);
    }
  }

  async function verifyAccount() {
    setBusy(true);
    setMessage('');

    try {
      await request('/users/me');
      setMessage('Authenticated account verified.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Your account</h2>

      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>

      <button type="button" onClick={verifyAccount} disabled={busy}>
        {busy ? 'Checking...' : 'Verify account access'}
      </button>

      <button type="button" onClick={signOut} disabled={signingOut}>
        {signingOut ? 'Logging out...' : 'Log out'}
      </button>

      <p role="status">{message}</p>
    </section>
  );
}

function App() {
  const auth = useAuth();
  const [gigVersion, setGigVersion] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);
  const [message, setMessage] = useState('Connection not checked.');
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    setMessage('Checking connection...');

    try {
      const result = await apiRequest('/health');

      setMessage(result.status === 'ok'
        ? 'API connected successfully.'
        : 'The API returned an unexpected status.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <h1>HustleHub+</h1>
      <p>A freelance marketplace for clients and freelancers.</p>

      {auth.notice && <p role="status">{auth.notice}</p>}

      {auth.session ? (
        <AccountPanel
          key={'account:' + auth.session.accessToken}
          user={auth.session.user}
          request={auth.request}
          onLogout={auth.logout}
        />
      ) : (
        <AuthForm onLogin={auth.login} />
      )}

      {auth.session?.user.role === 'freelancer' && (
        <FreelancerGigs
          key={'gigs:' + auth.session.accessToken}
          request={auth.request}
          onChange={() => setGigVersion(value => value + 1)}
        />
      )}

      <GigList
  key={'market:' + (auth.session?.accessToken || 'guest')}
  version={gigVersion}
  user={auth.session?.user}
  request={auth.request}
  onBooked={() => setActivityVersion(value => value + 1)}
/>

{auth.session && (
  <AccountActivity
    key={'activity:' + auth.session.accessToken}
    user={auth.session.user}
    request={auth.request}
    version={activityVersion}
  />
)}

      <section>
        <h2>API connection</h2>

        <button
          type="button"
          onClick={checkConnection}
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Check API connection'}
        </button>

        <p role="status">{message}</p>
      </section>
    </main>
  );
}

export default App;