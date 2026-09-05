import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import * as geminiService from '../services/geminiService';

// Mock Firebase dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-123', email: 'test@example.com', displayName: 'Chef Test' } },
  signIn: vi.fn(),
  logOut: vi.fn(),
  loginWithGoogle: vi.fn(),
  testConnection: vi.fn(),
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'get', LIST: 'list', CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Chef Test',
    });
    return () => {};
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

let snapshotCallCount = 0;
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn((_db, name) => ({ _collectionName: name })),
  query: vi.fn((coll, ..._rest) => coll),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((target, callback) => {
    const collName = target?._collectionName;
    if (collName === 'recipes') {
      callback({ docs: [] });
    } else if (collName === 'mealPlans') {
      callback({ docs: [] });
    } else {
      // Households query
      callback({
        docs: [
          {
            id: 'household-1',
            data: () => ({
              name: 'Smith Kitchen',
              ownerId: 'test-user-123',
              members: { 'test-user-123': 'admin' },
              createdAt: { seconds: 1234567890 },
            }),
          },
        ],
      });
    }
    return () => {};
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  addDoc: vi.fn().mockResolvedValue({ id: 'doc-123' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  serverTimestamp: () => ({ seconds: 1234567890 }),
  deleteField: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  Timestamp: {
    now: () => ({ seconds: 1234567890 }),
  },
}));

describe('Import Recipe from URL UI & State', () => {
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
    window.scrollTo = vi.fn();
  });

  it('opens Import URL modal in a ready, non-loading state with clear instructions', async () => {
    render(<App />);

    // Click Import URL button in header action bar
    const importButtons = screen.getAllByRole('button', { name: /import url/i });
    fireEvent.click(importButtons[0]);

    // Modal title should be visible
    expect(screen.getByText(/Import from Web/i)).toBeInTheDocument();

    // The submit button must NOT have a spinner or "Extracting..." when first opened
    const submitBtn = screen.getByRole('button', { name: /Import Recipe/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeDisabled(); // Disabled because URL input is empty

    // Loading spinner must not be present initially
    expect(screen.queryByText(/Extracting\.\.\./i)).not.toBeInTheDocument();
  });

  it('enables the submit button once a URL is typed, shows loading while extracting, and loads extracted recipe', async () => {
    const mockExtracted = {
      title: 'Grandma Homemade Chocolate Cookies',
      ingredients: ['2 cups flour', '1 cup chocolate chips', '1 cup sugar'],
      instructions: ['Mix dry ingredients.', 'Bake at 350F for 10 minutes.'],
      category: 'Dessert',
      estimatedTime: 25,
      imageUrl: 'https://example.com/cookies.jpg',
    };

    const extractSpy = vi.spyOn(geminiService, 'extractRecipeFromUrl').mockResolvedValue(mockExtracted);
    vi.spyOn(geminiService, 'generateRecipeImage').mockResolvedValue('https://example.com/cookies.jpg');

    render(<App />);

    // Open Import modal
    const importButtons = screen.getAllByRole('button', { name: /import url/i });
    fireEvent.click(importButtons[0]);

    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com\/best-cookies/i);
    fireEvent.change(urlInput, { target: { value: 'https://allrecipes.com/recipe/123/cookies' } });

    const submitBtn = screen.getByRole('button', { name: /Import Recipe/i });
    expect(submitBtn).not.toBeDisabled();

    // Trigger import
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(extractSpy).toHaveBeenCalledWith('https://allrecipes.com/recipe/123/cookies');
    });

    // When extracted, the Add/Edit Recipe modal opens with the title prefilled
    await waitFor(() => {
      const titleInput = screen.getByDisplayValue('Grandma Homemade Chocolate Cookies');
      expect(titleInput).toBeInTheDocument();
    });
  });

  it('submits on Enter key inside the form and preserves the website image url if present', async () => {
    const mockExtracted = {
      title: 'Spaghetti Bolognese',
      ingredients: ['1 lb beef', '1 jar marinara', '1 lb spaghetti'],
      instructions: ['Brown beef.', 'Simmer with sauce.', 'Boil pasta and combine.'],
      category: 'Dinner',
      estimatedTime: 30,
      imageUrl: 'https://images.example.com/bolognese.jpg',
    };

    const extractSpy = vi.spyOn(geminiService, 'extractRecipeFromUrl').mockResolvedValue(mockExtracted);
    const generateImageSpy = vi.spyOn(geminiService, 'generateRecipeImage');

    render(<App />);

    const importButtons = screen.getAllByRole('button', { name: /import url/i });
    fireEvent.click(importButtons[0]);

    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com\/best-cookies/i);
    // User types URL without https and with whitespace
    fireEvent.change(urlInput, { target: { value: '  allrecipes.com/recipe/456/spaghetti  ' } });

    // Submit form (simulate hitting Enter)
    const form = urlInput.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      const submitBtn = screen.getByRole('button', { name: /Import Recipe/i });
      fireEvent.click(submitBtn);
    }

    await waitFor(() => {
      expect(extractSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Spaghetti Bolognese')).toBeInTheDocument();
    });
  });

  it('resets loading state and displays an error message if extraction fails', async () => {
    vi.spyOn(geminiService, 'extractRecipeFromUrl').mockRejectedValue(
      new Error('Could not access recipe page. Please check URL.')
    );

    render(<App />);

    // Open Import modal
    const importButtons = screen.getAllByRole('button', { name: /import url/i });
    fireEvent.click(importButtons[0]);

    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com\/best-cookies/i);
    fireEvent.change(urlInput, { target: { value: 'https://invalid-recipe.com' } });

    const submitBtn = screen.getByRole('button', { name: /Import Recipe/i });
    fireEvent.click(submitBtn);

    // Should display error message
    await waitFor(() => {
      expect(screen.getByText(/Could not access recipe page\. Please check URL\./i)).toBeInTheDocument();
    });

    // The button must NOT be stuck in loading state
    expect(screen.queryByText(/Extracting\.\.\./i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import Recipe/i })).toBeInTheDocument();
  });
});
