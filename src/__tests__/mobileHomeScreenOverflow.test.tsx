import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock Firebase dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123', displayName: 'Chef Alex', photoURL: 'https://example.com/p.jpg' } },
  signIn: vi.fn(),
  logOut: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({
      uid: 'user_123',
      displayName: 'Chef Alex',
      photoURL: 'https://example.com/p.jpg'
    });
    return () => {};
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((q, callback) => {
    // If query has householdId filter, return recipes; otherwise households
    const isRecipeQuery = q && q._query && JSON.stringify(q._query).includes('recipes');
    callback({
      docs: [
        {
          id: 'hh_123',
          data: () => ({
            name: 'Alex Family Kitchen',
            ownerId: 'user_123',
            members: { user_123: 'owner' },
            createdAt: { seconds: 1234567890 },
            title: 'Sample Salmon Bowl',
            ingredients: ['salmon', 'rice'],
            instructions: ['Cook and serve.'],
            category: 'Dinner',
            rating: 5,
            isStaple: true,
            authorId: 'user_123',
            householdId: 'hh_123'
          })
        }
      ]
    });
    return () => {};
  }),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  serverTimestamp: () => ({ seconds: 1234567890 }),
  deleteField: vi.fn(),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  })),
  Timestamp: {
    now: () => ({ seconds: 1234567890 })
  }
}));

describe('Mobile Home Screen Horizontal Overflow Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('ensures root container and main content enforce horizontal overflow clipping and full width', async () => {
    const { container } = render(<App />);

    // The root layout container should enforce overflow-x-hidden and full width
    const rootLayout = container.querySelector('.min-h-screen');
    expect(rootLayout).not.toBeNull();
    expect(rootLayout?.className).toContain('overflow-x-hidden');
    expect(rootLayout?.className).toContain('w-full');
    expect(rootLayout?.className).toContain('max-w-full');

    const mainContent = container.querySelector('#main-content');
    expect(mainContent).not.toBeNull();
    expect(mainContent?.className).toContain('overflow-x-hidden');
    expect(mainContent?.className).toContain('w-full');
    expect(mainContent?.className).toContain('max-w-full');
  });

  it('ensures header has mobile-responsive layout preventing horizontal blowout', async () => {
    const { container } = render(<App />);

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('w-full');
    expect(header?.className).toContain('max-w-full');

    // On mobile screens, the header should have mobile-adapted navigation controls
    // so that the switcher tabs and user household controls do not force >500px in a single line
    const mobileTabSwitcher = container.querySelector('[data-testid="mobile-tab-switcher"]');
    expect(mobileTabSwitcher).not.toBeNull();
  });

  it('ensures category filters and search section prevent flex child blowout with min-w-0', async () => {
    const { container } = render(<App />);

    const filterSection = container.querySelector('[data-testid="filters-and-search-section"]');
    expect(filterSection).not.toBeNull();
    expect(filterSection?.className).toContain('min-w-0');
    expect(filterSection?.className).toContain('w-full');

    const categoryScroll = container.querySelector('[data-testid="category-filter-scroll"]');
    expect(categoryScroll).not.toBeNull();
    expect(categoryScroll?.className).toContain('min-w-0');
    expect(categoryScroll?.className).toContain('w-full');
  });
});
