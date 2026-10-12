import { useState } from 'react';
import { apiRequest } from '../api';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'client'
};

function buildBody(mode, form) {
  const email = form.email.trim().toLowerCase();
  const password = form.password;

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('Enter a valid email address.');
  }

  if (
    !password ||
    password.length > 128 ||
    new TextEncoder().encode(password).length > 72
  ) {
    throw new Error('Enter a password using no more than 72 UTF-8 bytes.');
  }

  if (mode === 'login') {
    return { email, password };
  }

  const name = form.name.normalize('NFKC').trim();

  if (
    name.length < 2 ||
    name.length > 80 ||
    !/^[\p{L}\p{M} .'-]+$/u.test(name)
  ) {
    throw new Error(
      'Enter a name of 2–80 characters using letters, spaces or name punctuation.'
    );
  }

  if (
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      'Use at least 12 characters, with uppercase, lowercase, a number and a special character.'
    );
  }

  if (!['client', 'freelancer'].includes(form.role)) {
    throw new Error('Choose client or freelancer.');
  }

  return { name, email, password, role: form.role };
}

export default function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const registering = mode === 'register';

  function change(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  function switchMode() {
    setMode(registering ? 'login' : 'register');
    setForm({ ...emptyForm, email: form.email });
    setError('');
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const body = buildBody(mode, form);
      setBusy(true);

      const result = await apiRequest('/auth/' + mode, {
        method: 'POST',
        body
      });

      setForm({ ...emptyForm, email: body.email });

      if (registering) {
        setMode('login');
        setSuccess('Registration successful. Log in to continue.');
      } else {
        if (
          typeof result.accessToken !== 'string' ||
          !result.user?.id
        ) {
          throw new Error('Unable to complete login. Please try again.');
        }

        onLogin(result);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>{registering ? 'Register' : 'Log in'}</h2>

      {error && <p role="alert" className="error">{error}</p>}
      {success && <p role="status">{success}</p>}

      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          {registering && (
            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={change}
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={change}
              maxLength={128}
              autoComplete={
                registering ? 'new-password' : 'current-password'
              }
              required
            />
          </label>

          {registering && (
            <>
              <p className="hint">
                Password: at least 12 characters, uppercase, lowercase,
                a number and a special character. Maximum 72 UTF-8 bytes.
              </p>

              <label>
                Role
                <select
                  name="role"
                  value={form.role}
                  onChange={change}
                >
                  <option value="client">Client</option>
                  <option value="freelancer">Freelancer</option>
                </select>
              </label>
            </>
          )}

          <button type="submit">
            {busy
              ? 'Please wait...'
              : registering ? 'Register' : 'Log in'}
          </button>
        </fieldset>
      </form>

      <button type="button" onClick={switchMode} disabled={busy}>
        {registering ? 'Back to login' : 'Create an account'}
      </button>
    </section>
  );
}