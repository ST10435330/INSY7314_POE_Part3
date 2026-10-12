import { useEffect, useState } from 'react';

const emptyForm = {
  title: '',
  description: '',
  price: ''
};

function gigBody(form) {
  const title = form.title.normalize('NFKC').trim();
  const description = form.description.normalize('NFKC').trim();
  const price = Number(form.price);

  if (title.length < 3 || title.length > 100) {
    throw new Error('Title must contain 3–100 characters.');
  }

  if (description.length < 10 || description.length > 2000) {
    throw new Error('Description must contain 10–2000 characters.');
  }

  if (
    !Number.isFinite(price) ||
    price < 1 ||
    price > 1000000 ||
    price !== Number(price.toFixed(2))
  ) {
    throw new Error(
      'Enter a price from R1 to R1,000,000 with at most two decimal places.'
    );
  }

  return { title, description, price };
}

export default function FreelancerGigs({ request, onChange }) {
  const [list, setList] = useState({
    version: -1,
    gigs: [],
    error: ''
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loading = list.version !== version;
  const gigs = list.gigs;
  const problem = error || (loading ? '' : list.error);

  useEffect(() => {
    let ignore = false;

    request('/gigs/mine')
      .then(result => {
        if (!ignore) {
          setList({
            version,
            gigs: result.gigs,
            error: ''
          });
        }
      })
      .catch(error => {
        if (!ignore) {
          setList({
            version,
            gigs: [],
            error: error.message
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [request, version]);

  function change(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setEditingId('');
  }

  function edit(gig) {
    setEditingId(gig.id);
    setForm({
      title: gig.title,
      description: gig.description,
      price: String(gig.price)
    });
    setError('');
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const body = gigBody(form);
      setSaving(true);

      await request(editingId ? '/gigs/' + editingId : '/gigs', {
        method: editingId ? 'PATCH' : 'POST',
        body
      });

      setMessage(editingId ? 'Gig updated.' : 'Gig created.');
      reset();
      setVersion(value => value + 1);
      onChange();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await request('/gigs/' + id, { method: 'DELETE' });

      if (editingId === id) reset();

      setMessage('Gig removed from the marketplace.');
      setVersion(value => value + 1);
      onChange();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return (
    <section>
      <h2>Manage your gigs</h2>

      {problem && <p role="alert" className="error">{problem}</p>}
      {message && <p role="status">{message}</p>}

      <h3>{editingId ? 'Edit gig' : 'Create gig'}</h3>

      <form onSubmit={save} noValidate>
        <fieldset disabled={busy}>
          <label>
            Title
            <input
              name="title"
              value={form.title}
              onChange={change}
              minLength={3}
              maxLength={100}
              required
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={change}
              minLength={10}
              maxLength={2000}
              rows={4}
              required
            />
          </label>

          <label>
            Price (ZAR)
            <input
              name="price"
              type="number"
              value={form.price}
              onChange={change}
              min={1}
              max={1000000}
              step="0.01"
              required
            />
          </label>

          <button type="submit">
            {saving
              ? 'Saving...'
              : editingId ? 'Save changes' : 'Create gig'}
          </button>

          {editingId && (
            <button type="button" onClick={reset}>
              Cancel editing
            </button>
          )}
        </fieldset>
      </form>

      <h3>Your listings</h3>

      <button
        type="button"
        disabled={busy}
        onClick={() => setVersion(value => value + 1)}
      >
        Refresh your listings
      </button>

      {loading && <p role="status">Loading your listings...</p>}

      {!loading && !problem && gigs.length === 0 && (
        <p>You have no active gigs.</p>
      )}

      {!loading && gigs.map(gig => (
        <article className="gig" key={gig.id}>
          <h3>{gig.title}</h3>
          <p>{gig.description}</p>
          <p>Price: R{Number(gig.price).toFixed(2)}</p>

          <button
            type="button"
            onClick={() => edit(gig)}
            disabled={busy}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => remove(gig.id)}
            disabled={busy}
          >
            Delete
          </button>
        </article>
      ))}
    </section>
  );
}