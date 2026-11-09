import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api.js';
import BookGig from './BookGig.jsx';

export default function GigList({
  version = 0,
  user,
  request,
  onBooked
}) {
  const attempts = useRef(new Map());
  const [result, setResult] = useState({
    key: '', gigs: [], error: ''
  });
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const requestKey = page + ':' + version + ':' + refresh;
  const loading = result.key !== requestKey;
  const gigs = result.gigs;
  const error = loading ? '' : result.error;

  useEffect(() => {
    let ignore = false;

    apiRequest('/gigs?page=' + page + '&limit=10')
      .then(data => {
        if (!ignore) {
          setResult({
            key: requestKey, gigs: data.gigs, error: ''
          });
        }
      })
      .catch(error => {
        if (!ignore) {
          setResult({
            key: requestKey, gigs: [], error: error.message
          });
        }
      });

    return () => { ignore = true; };
  }, [page, requestKey]);

  return (
    <section>
      <div className="section-heading">
        <h2>Available gigs</h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRefresh(value => value + 1)}
        >
          Refresh gigs
        </button>
      </div>

      {loading && <p role="status">Loading gigs...</p>}
      {error && <p role="alert" className="error">{error}</p>}

      {!loading && !error && gigs.length === 0 && (
        <p>No gigs on this page.</p>
      )}

      <div className="marketplace-grid">
        {!loading && gigs.map(gig => (
          <article className="gig" key={gig.id}>
            <h3>{gig.title}</h3>
            <p>{gig.description}</p>
            <p>Freelancer: {gig.freelancerName || 'Freelancer'}</p>
            <p>Price: R{Number(gig.price).toFixed(2)}</p>

            {user?.role === 'client' && (
              <BookGig
                gig={gig}
                request={request}
                attempts={attempts}
                onBooked={onBooked}
              />
            )}
          </article>
        ))}
      </div>

      <footer className="pagination">
        <p>Page {page}</p>
        <button
          type="button"
          disabled={loading || page === 1}
          onClick={() => setPage(value => value - 1)}
        >
          Previous page
        </button>

        <button
          type="button"
          disabled={loading || !!error || gigs.length < 10}
          onClick={() => setPage(value => value + 1)}
        >
          Next page
        </button>
      </footer>
    </section>
  );
}