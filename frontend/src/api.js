const API_URL = (
  import.meta.env.VITE_API_URL || 'https://localhost:3443/api'
).replace(/\/$/, '');

export async function apiRequest(path, {
  method = 'GET',
  body,
  token
} = {}) {
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;

  let response;

  try {
    response = await fetch(API_URL + path, {
      method,
      headers,
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Unable to connect. Please try again.');
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (!response.ok) {
    const message = typeof data?.error?.message === 'string'
      ? data.error.message
      : 'The request could not be completed.';

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}