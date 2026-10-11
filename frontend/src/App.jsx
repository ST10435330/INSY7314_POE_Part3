import { useState } from 'react';
import { apiRequest } from './api';

function App() {
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

      <h2>API connection</h2>

      <button
        type="button"
        onClick={checkConnection}
        disabled={checking}
      >
        {checking ? 'Checking...' : 'Check API connection'}
      </button>

      <p role="status">{message}</p>
    </main>
  );
}

export default App;