import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookGig from './components/BookGig.jsx';
import AccountActivity from './components/AccountActivity.jsx';
import GigList from './components/GigList.jsx';
import { apiRequest } from './api.js';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));

const gig = {
  id: '507f1f77bcf86cd799439011',
  title: 'Logo design',
  description: 'A simple logo for your business.',
  price: 500
};

const receipt = {
  booking: { amount: 450 },
  transaction: { id: 'transaction-1' }
};

const user = { id: 'client-1', role: 'client' };

beforeEach(() => { vi.resetAllMocks(); });

test('booking sends only IDs and allows a deliberate second booking', async () => {
  const actions = userEvent.setup();
  const request = vi.fn().mockResolvedValue(receipt);
  const onBooked = vi.fn();

  render(
    <BookGig
      gig={gig}
      request={request}
      attempts={{ current: new Map() }}
      onBooked={onBooked}
    />
  );

  await actions.click(screen.getByRole('button', { name: 'Book gig' }));
  await screen.findByText(/Booking confirmed: R450.00/);

  const first = request.mock.calls[0][1].body;

  expect(request.mock.calls[0][0]).toBe('/bookings');
  expect(request.mock.calls[0][1].method).toBe('POST');
  expect(Object.keys(first).sort()).toEqual(['gigId', 'requestId']);
  expect(first.gigId).toBe(gig.id);
  expect(first.requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  await actions.click(screen.getByRole('button', { name: 'Book again' }));
  await waitFor(() => expect(onBooked).toHaveBeenCalledTimes(2));

  expect(request.mock.calls[1][1].body.requestId)
    .not.toBe(first.requestId);
});

test('failed requests keep the same ID after the gig component remounts', async () => {
  const actions = userEvent.setup();
  const attempts = { current: new Map() };

  const request = vi.fn()
    .mockRejectedValueOnce(new Error('Unable to connect. Please try again.'))
    .mockResolvedValueOnce(receipt);

  const props = { gig, request, attempts, onBooked: vi.fn() };
  const view = render(<BookGig {...props} />);

  await actions.click(screen.getByRole('button', { name: 'Book gig' }));
  await screen.findByRole('alert');

  const first = request.mock.calls[0][1].body.requestId;

  view.unmount();
  render(<BookGig {...props} />);

  await actions.click(screen.getByRole('button', { name: 'Book gig' }));
  await screen.findByText(/Booking confirmed/);

  expect(request.mock.calls[1][1].body.requestId).toBe(first);
  expect(attempts.current.size).toBe(0);
});

test('pending bookings cannot be submitted repeatedly', async () => {
  const actions = userEvent.setup();
  let finish;

  const request = vi.fn().mockReturnValue(
    new Promise(resolve => { finish = resolve; })
  );

  render(
    <BookGig
      gig={gig}
      request={request}
      attempts={{ current: new Map() }}
      onBooked={vi.fn()}
    />
  );

  await actions.click(screen.getByRole('button', { name: 'Book gig' }));

  const button = screen.getByRole('button', { name: 'Booking...' });
  expect(button).toBeDisabled();

  await actions.click(button);
  expect(request).toHaveBeenCalledTimes(1);

  finish(receipt);
  await screen.findByText(/Booking confirmed/);
});

test.each([
  undefined,
  { role: 'freelancer' },
  { role: 'client' }
])('booking controls appear only for clients: %j', async user => {
  apiRequest.mockResolvedValue({ gigs: [gig] });

  render(
    <GigList user={user} request={vi.fn()} onBooked={vi.fn()} />
  );

  await screen.findByText('Logo design');

  expect(screen.queryByRole('button', { name: 'Book gig' }) !== null)
    .toBe(user?.role === 'client');
});

test('clients see bookings and transactions without requesting income', async () => {
  const request = vi.fn(async path => path === '/bookings'
    ? {
        bookings: [{
          id: 'booking-1',
          gigTitle: gig.title,
          amount: 500,
          status: 'confirmed'
        }]
      }
    : {
        transactions: [{
          id: 'transaction-1',
          bookingId: 'booking-1',
          amount: 500,
          status: 'simulated'
        }]
      });

  render(<AccountActivity user={user} request={request} />);

  await screen.findByText('Transaction ID: transaction-1');

  expect(screen.getByText('Logo design')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith('/income');
  expect(screen.queryByText('Simulated income')).not.toBeInTheDocument();
});

test('freelancer income can be refreshed', async () => {
  const actions = userEvent.setup();
  let total = 500;

  const request = vi.fn(async path => {
    if (path === '/income') {
      return { income: { totalIncome: total, bookingCount: 1 } };
    }

    return path === '/bookings'
      ? { bookings: [] }
      : { transactions: [] };
  });

  render(
    <AccountActivity user={{ role: 'freelancer' }} request={request} />
  );

  await screen.findByText('Total: R500.00');

  total = 900;
  await actions.click(
    screen.getByRole('button', { name: 'Refresh activity' })
  );

  await screen.findByText('Total: R900.00');
});

test('activity errors are displayed and can be retried', async () => {
  const actions = userEvent.setup();

  const request = vi.fn().mockRejectedValue(
    new Error('Unable to connect. Please try again.')
  );

  render(<AccountActivity user={user} request={request} />);
  await screen.findByRole('alert');

  request.mockImplementation(async path => path === '/bookings'
    ? { bookings: [] }
    : { transactions: [] });

  await actions.click(
    screen.getByRole('button', { name: 'Refresh activity' })
  );

  await screen.findByText('No bookings yet.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('transactions support pagination', async () => {
  const actions = userEvent.setup();

  const request = vi.fn(async path => {
    if (path === '/bookings') return { bookings: [] };

    return {
      transactions: path.includes('page=1')
        ? Array.from({ length: 10 }, (_, index) => ({
            id: 'transaction-' + index,
            bookingId: 'booking-' + index,
            amount: 10,
            status: 'simulated'
          }))
        : []
    };
  });

  render(<AccountActivity user={user} request={request} />);
  await screen.findByText('Transaction ID: transaction-0');

  await actions.click(
    screen.getByRole('button', { name: 'Next transactions' })
  );

  await screen.findByText('Transactions page 2');
  expect(request).toHaveBeenCalledWith('/transactions?page=2&limit=10');
});