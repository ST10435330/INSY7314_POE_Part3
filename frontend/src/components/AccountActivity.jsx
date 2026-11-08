import { useEffect, useState } from 'react';
import IncomeSummary from './IncomeSummary.jsx';

export default function AccountActivity({ user, request, version = 0 }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({
    key: '',
    bookings: [],
    transactions: [],
    income: null,
    taxEstimate: null,
    error: ''
  });

  const requestKey = page + ':' + version + ':' + refresh;
  const loading = result.key !== requestKey;
  const error = loading ? '' : result.error;

  useEffect(() => {
    let ignore = false;

    Promise.all([
      request('/bookings'),
      request('/transactions?page=' + page + '&limit=10'),
      user.role === 'freelancer'
        ? request('/income')
        : Promise.resolve(null)
    ])
      .then(([bookings, transactions, income]) => {
        if (!ignore) {
          setResult({
            key: requestKey,
            bookings: bookings.bookings,
            transactions: transactions.transactions,
            income: income?.income || null,
            taxEstimate: income?.taxEstimate || null,
            error: ''
          });
        }
      })
      .catch(error => {
        if (!ignore) {
          setResult({
            key: requestKey,
            bookings: [],
            transactions: [],
            income: null,
            taxEstimate: null,
            error: error.message
          });
        }
      });

    return () => { ignore = true; };
  }, [page, requestKey, request, user.role]);

  return (
    <section>
      <h2>Your activity</h2>
      <p>Bookings use simulated payments.</p>

      <button
        type="button"
        disabled={loading}
        onClick={() => setRefresh(value => value + 1)}
      >
        Refresh activity
      </button>

      {loading && <p role="status">Loading activity...</p>}
      {error && <p role="alert" className="error">{error}</p>}

      {!loading && !error && (
        <>
          {result.income && (
            <IncomeSummary income={result.income} taxEstimate={result.taxEstimate} />
          )}

          <h3>Your bookings</h3>

          {result.bookings.length === 0 && <p>No bookings yet.</p>}

          {result.bookings.map(booking => (
            <article className="gig" key={booking.id}>
              <h4>{booking.gigTitle}</h4>
              <p>Amount: R{Number(booking.amount).toFixed(2)}</p>
              <p>Status: {booking.status}</p>
              <p>Booking ID: {booking.id}</p>
            </article>
          ))}

          <h3>Your transactions</h3>

          {result.transactions.length === 0 && (
            <p>No transactions on this page.</p>
          )}

          {result.transactions.map(transaction => (
            <article className="gig" key={transaction.id}>
              <p>Transaction ID: {transaction.id}</p>
              <p>Booking ID: {transaction.bookingId}</p>
              <p>Amount: R{Number(transaction.amount).toFixed(2)}</p>
              <p>Status: {transaction.status}</p>
            </article>
          ))}

          <p>Transactions page {page}</p>

          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(value => value - 1)}
          >
            Previous transactions
          </button>

          <button
            type="button"
            disabled={result.transactions.length < 10}
            onClick={() => setPage(value => value + 1)}
          >
            Next transactions
          </button>
        </>
      )}
    </section>
  );
}