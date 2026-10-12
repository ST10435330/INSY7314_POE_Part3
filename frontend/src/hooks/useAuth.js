import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '../api';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState('');
  const currentSession = useRef(null);

  const login = useCallback(result => {
    const next = {
      user: result.user,
      accessToken: result.accessToken
    };

    currentSession.current = next;
    setSession(next);
    setNotice('Logged in successfully.');
  }, []);

  const logout = useCallback(() => {
    currentSession.current = null;
    setSession(null);
    setNotice('You have logged out.');
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const current = currentSession.current;

    if (!current) {
      throw new Error('Please log in to continue.');
    }

    try {
      const result = await apiRequest(path, {
        ...options,
        token: current.accessToken
      });

      if (currentSession.current !== current) {
        throw new Error('The session changed. Please try again.');
      }

      return result;
    } catch (error) {
      if (error.status === 401 && currentSession.current === current) {
        currentSession.current = null;
        setSession(null);
        setNotice('Your session has expired. Please log in again.');
      }

      throw error;
    }
  }, []);

  return { session, notice, login, logout, request };
}