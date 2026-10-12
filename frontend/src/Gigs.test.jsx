import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GigList from './components/GigList.jsx';
import FreelancerGigs from './components/FreelancerGigs.jsx';
import { apiRequest } from './api';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));

const gig = {
  id: '507f1f77bcf86cd799439011',
  title: 'Logo design',
  description: 'A simple logo design service.',
  price: 450.5,
  freelancerName: 'Demo Freelancer'
};

test('public gigs render with prices and escaped descriptions', async () => {
  apiRequest.mockReset();

  apiRequest.mockResolvedValue({
    gigs: [{
      ...gig,
      description: '<img src=x onerror=alert(1)>'
    }]
  });

  render(<GigList />);
  await screen.findByRole('heading', { name: 'Logo design' });

  expect(apiRequest).toHaveBeenCalledWith('/gigs?page=1&limit=10');
  expect(screen.getByText('Price: R450.50')).toBeInTheDocument();

  expect(
    screen.getByText('<img src=x onerror=alert(1)>')
  ).toBeInTheDocument();

  expect(document.querySelector('img')).toBeNull();

  expect(
    screen.queryByRole('button', { name: 'Edit' })
  ).not.toBeInTheDocument();
});

test('public gig pagination retrieves the next page', async () => {
  const actions = userEvent.setup();
  apiRequest.mockReset();

  apiRequest.mockImplementation(path => Promise.resolve({
    gigs: path.includes('page=1&')
      ? Array.from({ length: 10 }, (_, index) => ({
          ...gig,
          id: String(index),
          title: 'Listing ' + index
        }))
      : [{ ...gig, title: 'Second page gig' }]
  }));

  render(<GigList />);
  await screen.findByRole('heading', { name: 'Listing 0' });

  await actions.click(
    screen.getByRole('button', { name: 'Next page' })
  );

  await screen.findByRole('heading', { name: 'Second page gig' });

  expect(apiRequest).toHaveBeenLastCalledWith('/gigs?page=2&limit=10');

  expect(
    screen.getByRole('button', { name: 'Next page' })
  ).toBeDisabled();
});

test('public listing errors allow a retry and empty listings have a clear message', async () => {
  const actions = userEvent.setup();
  apiRequest.mockReset();

  apiRequest.mockRejectedValueOnce(
    new Error('Unable to connect. Please try again.')
  );

  apiRequest.mockResolvedValueOnce({ gigs: [] });

  render(<GigList />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to connect'
  );

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Refresh gigs' })
    ).toBeEnabled();
  });

  await actions.click(
    screen.getByRole('button', { name: 'Refresh gigs' })
  );

  await screen.findByText('No gigs on this page.');
});

test('a freelancer can create a gig using a numeric price and refresh the listings', async () => {
  const actions = userEvent.setup();

  const request = vi.fn().mockImplementation(() =>
    Promise.resolve({ gigs: [] })
  );

  const onChange = vi.fn();

  render(
    <FreelancerGigs request={request} onChange={onChange} />
  );

  await screen.findByText('You have no active gigs.');

  await actions.type(screen.getByLabelText('Title'), 'Logo design');
  await actions.type(screen.getByLabelText('Description'), gig.description);
  await actions.type(screen.getByLabelText('Price (ZAR)'), '450.50');

  await actions.click(
    screen.getByRole('button', { name: 'Create gig' })
  );

  await screen.findByText('Gig created.');

  expect(request).toHaveBeenCalledWith('/gigs', {
    method: 'POST',
    body: {
      title: 'Logo design',
      description: gig.description,
      price: 450.5
    }
  });

  expect(onChange).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Title')).toHaveValue('');
});

test('invalid gig inputs are blocked before a write request', async () => {
  const actions = userEvent.setup();
  const request = vi.fn().mockResolvedValue({ gigs: [] });

  render(
    <FreelancerGigs request={request} onChange={vi.fn()} />
  );

  await screen.findByText('You have no active gigs.');

  await actions.click(
    screen.getByRole('button', { name: 'Create gig' })
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Title must contain'
  );

  await actions.type(screen.getByLabelText('Title'), 'Logo design');
  await actions.type(screen.getByLabelText('Description'), gig.description);
  await actions.type(screen.getByLabelText('Price (ZAR)'), '0');

  await actions.click(
    screen.getByRole('button', { name: 'Create gig' })
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a price');
  expect(request).toHaveBeenCalledTimes(1);
});

test('a freelancer can edit and remove their own displayed gig', async () => {
  const actions = userEvent.setup();
  let owned = [{ ...gig }];

  const request = vi.fn().mockImplementation((path, options) => {
    if (options?.method === 'PATCH') {
      owned = [{ ...owned[0], ...options.body }];
      return Promise.resolve({ gig: owned[0] });
    }

    if (options?.method === 'DELETE') {
      owned = [];
      return Promise.resolve({ message: 'Gig removed.' });
    }

    return Promise.resolve({ gigs: owned });
  });

  const onChange = vi.fn();

  render(
    <FreelancerGigs request={request} onChange={onChange} />
  );

  await screen.findByRole('heading', { name: 'Logo design' });

  await actions.click(
    screen.getByRole('button', { name: 'Edit' })
  );

  expect(screen.getByLabelText('Title')).toHaveValue('Logo design');

  await actions.clear(screen.getByLabelText('Price (ZAR)'));
  await actions.type(screen.getByLabelText('Price (ZAR)'), '500');

  await actions.click(
    screen.getByRole('button', { name: 'Save changes' })
  );

  await screen.findByText('Price: R500.00');

  expect(request).toHaveBeenCalledWith('/gigs/' + gig.id, {
    method: 'PATCH',
    body: {
      title: gig.title,
      description: gig.description,
      price: 500
    }
  });

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Delete' })
    ).toBeEnabled();
  });

  await actions.click(
    screen.getByRole('button', { name: 'Delete' })
  );

  await screen.findByText('You have no active gigs.');

  expect(request).toHaveBeenCalledWith('/gigs/' + gig.id, {
    method: 'DELETE'
  });

  expect(onChange).toHaveBeenCalledTimes(2);
});