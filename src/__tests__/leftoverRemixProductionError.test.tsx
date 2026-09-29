import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LeftoverRemixModal } from '../components/LeftoverRemixModal';
import * as geminiService from '../services/geminiService';
import { parseApiErrorMessage } from '../services/geminiService';

describe('Leftover Remix Production Error Handling & Resilience (TDD)', () => {
  const mockPastMeals = [
    {
      id: 'meal-1',
      recipeId: 'rec-1',
      recipeTitle: 'Smoked Beef Jerky & Rice',
      mealType: 'Dinner' as const,
      cookedDate: '2026-09-08',
      dayName: 'Monday',
      dateStr: '2026-09-08',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseApiErrorMessage returns helpful explanation when server returns 500 internal server error', () => {
    const error500 = { error: 'An internal server error occurred.' };
    const msg = parseApiErrorMessage(error500, 500, 'Failed to generate leftover remixes.');
    expect(msg).toContain('server error');
  });

  it('LeftoverRemixModal displays friendly server error and provides instant Chef Remix fallback button', async () => {
    // Mock remixLeftovers to reject with server error as happens in production
    vi.spyOn(geminiService, 'remixLeftovers').mockRejectedValueOnce(
      new Error('The leftover remix service encountered a server error (500). Please retry or use instant chef remixes.')
    );

    render(
      <LeftoverRemixModal
        isOpen={true}
        onClose={vi.fn()}
        pastMeals={mockPastMeals}
      />
    );

    // Enter a custom fridge ingredient to ensure an active selection
    const customInput = screen.getByPlaceholderText(/cooked rice, black beans/i);
    fireEvent.change(customInput, { target: { value: 'Cold Rice, Bell Pepper' } });
    const addTagBtn = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addTagBtn);

    // Click generate button
    const generateBtn = screen.getByRole('button', { name: /generate 3 remix dishes/i });
    fireEvent.click(generateBtn);

    // Wait for the error banner to appear
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    // An instant fallback action button should be available so user is never stranded
    const instantFallbackBtn = screen.getByRole('button', { name: /instant chef remix/i });
    expect(instantFallbackBtn).toBeInTheDocument();

    // Clicking the instant fallback button should load valid dishes and clear error
    fireEvent.click(instantFallbackBtn);

    await waitFor(() => {
      expect(screen.queryByText(/server error/i)).not.toBeInTheDocument();
      expect(screen.getByText(/sizzling skillet/i)).toBeInTheDocument();
    });
  });

  it('client-side generateClientFallbackRemixes creates 3 valid recipes with ingredients, instructions, and proTips', () => {
    const fallback = geminiService.generateClientFallbackRemixes(
      [{ name: 'Roast Chicken' }],
      'rice, broccoli'
    );

    expect(fallback.remixes).toHaveLength(3);
    expect(fallback.remixes[0].title).toContain('Roast Chicken');
    expect(fallback.remixes[0].ingredients.length).toBeGreaterThan(0);
    expect(fallback.remixes[0].instructions.length).toBeGreaterThan(0);
    expect(fallback.remixes[0].proTips).toBeTruthy();
  });
});
