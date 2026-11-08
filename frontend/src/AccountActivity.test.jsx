import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccountActivity from './components/AccountActivity.jsx';

test('freelancers see the server-calculated tax beside their simulated income', async () => {
  const request = vi.fn(async path => {
    if (path === '/bookings') return { bookings: [] };
    if (path.startsWith('/transactions')) return { transactions: [] };
    return {
      income: { totalIncome: 1000, bookingCount: 1 },
      taxEstimate: { ratePercent: 20, estimatedTax: 200, afterEstimatedTax: 800 }
    };
  });

  render(<AccountActivity user={{ role: 'freelancer' }} request={request} />);
  await screen.findByRole('heading', { name: 'Freelancer income and tax' });
  expect(screen.getByText('Estimated tax (20%)')).toBeInTheDocument();
  const amounts = screen.getAllByRole('definition').map(term => term.textContent);
  expect(amounts.map(amount => amount.replace(/\s/g, ''))).toEqual(['R1000,00', 'R200,00', 'R800,00']);
});

test('client activity does not fetch or display the freelancer income estimate', async () => {
  const request = vi.fn(async () => ({ bookings: [], transactions: [] }));
  render(<AccountActivity user={{ role: 'client' }} request={request} />);
  await screen.findByRole('heading', { name: 'Your transactions' });
  expect(screen.queryByText('Estimated tax')).not.toBeInTheDocument();
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/bookings', '/transactions?page=1&limit=10']);
});
