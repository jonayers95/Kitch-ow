import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import * as geminiService from '../services/geminiService';

// Mock auth and firestore
vi.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'user_123', email: 'test@example.com', displayName: 'Test User' },
  },
  signIn: vi.fn(),
  logOut: vi.fn(),
  loginWithGoogle: vi.fn(),
  testConnection: vi.fn(),
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'get', LIST: 'list', CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({
      uid: 'user_123',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    return () => {};
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _collectionName: name })),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  addDoc: vi.fn().mockResolvedValue({ id: 'doc_123' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn((coll) => coll),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((target, callback) => {
    const collName = target?._collectionName;
    if (collName === 'recipes') {
      callback({ docs: [] });
    } else if (collName === 'mealPlans') {
      callback({ docs: [] });
    } else {
      callback({
        docs: [
          {
            id: 'household-1',
            data: () => ({
              name: 'Smith Kitchen',
              ownerId: 'user_123',
              members: { 'user_123': 'admin' },
              createdAt: { seconds: 1234567890 },
            }),
          },
        ],
      });
    }
    return () => {};
  }),
  serverTimestamp: () => ({ seconds: 1234567890 }),
  deleteField: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  Timestamp: {
    now: () => ({ seconds: 123456789, nanoseconds: 0 }),
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
}));

describe('Recipe Import Error Handling in Production & Edge Cases', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('never displays "[object Object]" when server returns Vercel 404 JSON error object', async () => {
    // Exact response returned by Vercel when API route is missing in production:
    // HTTP 404 with body {"error": {"code": "404", "message": "The page could not be found"}}
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: { code: '404', message: 'The page could not be found' },
      }),
      text: async () => JSON.stringify({ error: { code: '404', message: 'The page could not be found' } }),
    } as any);

    render(<App />);

    // Open Import modal
    const importButtons = screen.getAllByRole('button', { name: /import url/i });
    fireEvent.click(importButtons[0]);

    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com\/best-cookies/i);
    fireEvent.change(urlInput, { target: { value: 'https://www.jerkyholic.com/smoked-beef-jerky' } });

    const submitBtn = screen.getByRole('button', { name: /Import Recipe/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.submit(urlInput.closest('form')!);

    // Verify error banner appears with a helpful message, and strictly NOT "[object Object]"
    await waitFor(() => {
      const renderedError = screen.getByRole('alert');
      expect(renderedError).toBeInTheDocument();
      expect(renderedError.textContent).not.toContain('[object Object]');
      expect(renderedError.textContent).toMatch(/not found|page could not be found|failed|configured/i);
    }, { timeout: 3000 });

    expect(screen.queryByText('[object Object]')).toBeNull();
    expect(screen.queryByText(/\[object Object\]/i)).toBeNull();
  });

  it('extractRecipeFromUrl parses structured error objects without converting to [object Object]', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: { code: '404', message: 'The page could not be found' },
      }),
      text: async () => JSON.stringify({ error: { code: '404', message: 'The page could not be found' } }),
    } as any);

    let caughtError: any = null;
    try {
      await geminiService.extractRecipeFromUrl('https://www.jerkyholic.com/smoked-beef-jerky');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.message).not.toBe('[object Object]');
    expect(caughtError.message).not.toContain('[object Object]');
    expect(caughtError.message).toMatch(/not found|page could not be found|unavailable/i);
  });

  it('extractRecipeFromUrl handles string errors correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: 'Could not extract recipe details from this webpage.',
      }),
      text: async () => JSON.stringify({ error: 'Could not extract recipe details from this webpage.' }),
    } as any);

    await expect(
      geminiService.extractRecipeFromUrl('https://example.com/recipe')
    ).rejects.toThrow('Could not extract recipe details from this webpage.');
  });

  it('extractRecipeFromUrl handles top-level message properties', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: (header: string) => (header.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        message: 'Internal server failure occurred.',
      }),
      text: async () => JSON.stringify({ message: 'Internal server failure occurred.' }),
    } as any);

    await expect(
      geminiService.extractRecipeFromUrl('https://example.com/recipe')
    ).rejects.toThrow('Internal server failure occurred.');
  });
});
