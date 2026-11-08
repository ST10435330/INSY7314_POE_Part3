import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { apiRequest } from './api';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));
vi.mock('./components/GigList.jsx', () => ({
  default: () => null
}));

vi.mock('./components/FreelancerGigs.jsx', () => ({
  default: () => <p>Freelancer management</p>
}));

vi.mock('./components/AccountActivity.jsx', () => ({
  default: () => null
}));

const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Demo Client',
  email: 'demo@example.com',
  role: 'client'
};

const loginResult = {
  user,
  accessToken: 'test-access-token'
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

async function fillLogin(actions) {
  await actions.type(
    screen.getByLabelText('Email'),
    'demo@example.com'
  );

  await actions.type(
    screen.getByLabelText('Password'),
    'SecurePass123!'
  );

  await actions.click(
    screen.getByRole('button', { name: 'Log in' })
  );
}

test('renders the login form and rejects missing input without an API call', async () => {
  const actions = userEvent.setup();
  render(<App />);

  expect(
    screen.getByRole('heading', { name: 'HustleHub+' })
  ).toBeInTheDocument();

  await actions.click(
    screen.getByRole('button', { name: 'Log in' })
  );

  expect(screen.getByRole('alert')).toHaveTextContent('valid email');
  expect(apiRequest).not.toHaveBeenCalled();
});

test('registration rejects invalid names, weak passwords and oversized UTF-8 passwords', async () => {
  const actions = userEvent.setup();
  render(<App />);

  await actions.click(
    screen.getByRole('button', { name: 'Create an account' })
  );

  await actions.type(screen.getByLabelText('Name'), '<script>');
  await actions.type(screen.getByLabelText('Email'), 'demo@example.com');
  await actions.type(screen.getByLabelText('Password'), 'SecurePass123!');
  await actions.click(screen.getByRole('button', { name: 'Register' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');

  await actions.clear(screen.getByLabelText('Name'));
  await actions.type(screen.getByLabelText('Name'), 'Demo Client');
  await actions.clear(screen.getByLabelText('Password'));
  await actions.type(screen.getByLabelText('Password'), 'weak');
  await actions.click(screen.getByRole('button', { name: 'Register' }));

  expect(screen.getByRole('alert')).toHaveTextContent('at least 12');

  await actions.clear(screen.getByLabelText('Password'));
  await actions.type(
    screen.getByLabelText('Password'),
    'SecurePass123!' + 'é'.repeat(35)
  );

  await actions.click(screen.getByRole('button', { name: 'Register' }));

  expect(screen.getByRole('alert')).toHaveTextContent('72 UTF-8 bytes');
  expect(apiRequest).not.toHaveBeenCalled();
});

test('registration submits the chosen role and returns to login with a cleared password', async () => {
  const actions = userEvent.setup();
  apiRequest.mockResolvedValueOnce({ user });
  render(<App />);

  await actions.click(
    screen.getByRole('button', { name: 'Create an account' })
  );

  await actions.type(screen.getByLabelText('Name'), 'Demo Freelancer');
  await actions.type(screen.getByLabelText('Email'), 'DEMO@example.com');
  await actions.type(screen.getByLabelText('Password'), 'SecurePass123!');
  await actions.selectOptions(screen.getByLabelText('Role'), 'freelancer');
  await actions.click(screen.getByRole('button', { name: 'Register' }));

  await screen.findByText('Registration successful. Log in to continue.');

  expect(apiRequest).toHaveBeenCalledWith('/auth/register', {
    method: 'POST',
    body: {
      name: 'Demo Freelancer',
      email: 'demo@example.com',
      password: 'SecurePass123!',
      role: 'freelancer'
    }
  });

  expect(screen.getByLabelText('Password')).toHaveValue('');
  expect(
    screen.getByRole('heading', { name: 'Log in' })
  ).toBeInTheDocument();
});

test('login displays controlled credential errors without showing the password', async () => {
  const actions = userEvent.setup();

  apiRequest.mockRejectedValueOnce(
    new Error('Email or password is incorrect.')
  );

  render(<App />);
  await fillLogin(actions);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Email or password is incorrect.'
  );

  expect(document.body.textContent).not.toContain('SecurePass123!');
});

test('login supplies the token to protected requests and logout clears the account view', async () => {
  const actions = userEvent.setup();

  apiRequest
    .mockResolvedValueOnce(loginResult)
    .mockResolvedValueOnce({ user });

  render(<App />);
  await fillLogin(actions);
  await screen.findByText('Name: Demo Client');

  await actions.click(
    screen.getByRole('button', { name: 'Verify account access' })
  );

  await screen.findByText('Authenticated account verified.');

  expect(apiRequest).toHaveBeenLastCalledWith('/users/me', {
    token: 'test-access-token'
  });

  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);

  apiRequest.mockResolvedValueOnce(undefined);

  await actions.click(
    screen.getByRole('button', { name: 'Log out' })
  );

  expect(apiRequest).toHaveBeenLastCalledWith('/auth/logout', {
    method: 'POST',
    token: 'test-access-token'
  });
  await screen.findByRole('heading', { name: 'Log in' });
  expect(screen.queryByText('Name: Demo Client')).not.toBeInTheDocument();
});

test('a failed logout keeps the session available for a retry', async () => {
  const actions = userEvent.setup();
  apiRequest
    .mockResolvedValueOnce(loginResult)
    .mockRejectedValueOnce(new Error('Unable to connect.'))
    .mockResolvedValueOnce(undefined);

  render(<App />);
  await fillLogin(actions);
  await screen.findByText('Name: Demo Client');
  await actions.click(screen.getByRole('button', { name: 'Log out' }));

  await screen.findByText('Could not end the session. Try logging out again.');
  expect(screen.getByText('Name: Demo Client')).toBeInTheDocument();

  await actions.click(screen.getByRole('button', { name: 'Log out' }));
  await screen.findByRole('heading', { name: 'Log in' });
});

test('an expired token clears the session and returns to login', async () => {
  const actions = userEvent.setup();
  const expired = new Error('The token is invalid or expired.');
  expired.status = 401;

  apiRequest
    .mockResolvedValueOnce(loginResult)
    .mockRejectedValueOnce(expired);

  render(<App />);
  await fillLogin(actions);
  await screen.findByText('Name: Demo Client');

  await actions.click(
    screen.getByRole('button', { name: 'Verify account access' })
  );

  await screen.findByText('Your session has expired. Please log in again.');

  expect(
    screen.getByRole('heading', { name: 'Log in' })
  ).toBeInTheDocument();

  expect(
    screen.queryByText('Name: Demo Client')
  ).not.toBeInTheDocument();
});

test('remounting the app requires login again and account text is escaped', async () => {
  const actions = userEvent.setup();
  const name = '<img src=x onerror=alert(1)>';

  apiRequest.mockResolvedValueOnce({
    ...loginResult,
    user: { ...user, name }
  });

  const view = render(<App />);
  await fillLogin(actions);

  await screen.findByText('Name: ' + name);
  expect(document.querySelector('img')).toBeNull();

  view.unmount();
  render(<App />);

  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: 'Log in' })
    ).toBeInTheDocument();
  });
});
test('gig management is shown only for freelancer sessions', async () => {
  const actions = userEvent.setup();

  apiRequest.mockResolvedValueOnce({
    ...loginResult,
    user: { ...user, role: 'freelancer' }
  });

  render(<App />);
  await fillLogin(actions);
  await screen.findByText('Freelancer management');

  apiRequest.mockResolvedValueOnce(undefined);

  await actions.click(
    screen.getByRole('button', { name: 'Log out' })
  );

  apiRequest.mockResolvedValueOnce(loginResult);
  await fillLogin(actions);
  await screen.findByText('Name: Demo Client');

  expect(
    screen.queryByText('Freelancer management')
  ).not.toBeInTheDocument();
});