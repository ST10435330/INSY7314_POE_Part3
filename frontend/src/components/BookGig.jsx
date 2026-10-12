import { useRef, useState } from 'react';

export default function BookGig({ gig, request, attempts, onBooked }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const submitting = useRef(false);

  async function book() {
    if (submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setError('');

    try {
      // Reuse this ID when retrying a failed request.
      let requestId = attempts.current.get(gig.id);

      if (!requestId) {
        requestId = crypto.randomUUID();
        attempts.current.set(gig.id, requestId);
      }

      const result = await request('/bookings', {
        method: 'POST',
        body: { gigId: gig.id, requestId }
      });

      attempts.current.delete(gig.id);
      setReceipt(result);
      onBooked();
    } catch (error) {
      setError(error.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={book}>
        {busy ? 'Booking...' : receipt ? 'Book again' : 'Book gig'}
      </button>

      {error && (
        <p role="alert" className="error">{error}</p>
      )}

      {receipt && (
        <p role="status">
          Booking confirmed: R{Number(receipt.booking.amount).toFixed(2)}.
          {' '}A simulated transaction was recorded.
        </p>
      )}
    </div>
  );
}