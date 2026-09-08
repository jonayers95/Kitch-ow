import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackModal } from '../components/FeedbackModal';
import * as feedbackService from '../services/feedbackService';

describe('FeedbackModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open with default bug report fields', () => {
    render(
      <FeedbackModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user_456', email: 'tester@example.com' } as any}
        household={{ id: 'hh_789', name: 'Pine Kitchen' } as any}
      />
    );

    expect(screen.getByText(/report a bug or request a feature/i)).toBeTruthy();
    expect(screen.getAllByText(/ayersaidev@gmail\.com/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/zero ai credits/i)).toBeTruthy();

    // Type toggles
    expect(screen.getByRole('button', { name: /bug report/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /feature request/i })).toBeTruthy();

    // Inputs
    expect(screen.getByPlaceholderText(/brief summary of the bug/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/describe what happened/i)).toBeTruthy();
    expect(screen.getByDisplayValue('tester@example.com')).toBeTruthy();
  });

  it('switches between Bug Report and Feature Request tabs', () => {
    render(
      <FeedbackModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={null}
        household={null}
      />
    );

    // Switch to Feature Request
    fireEvent.click(screen.getByRole('button', { name: /feature request/i }));
    expect(screen.getByPlaceholderText(/brief summary of the feature/i)).toBeTruthy();
    expect(screen.queryByLabelText(/severity/i)).toBeNull();

    // Switch back to Bug Report
    fireEvent.click(screen.getByRole('button', { name: /bug report/i }));
    expect(screen.getByPlaceholderText(/brief summary of the bug/i)).toBeTruthy();
    expect(screen.getByLabelText(/severity/i)).toBeTruthy();
  });

  it('submits a bug report to AyersAIDev@gmail.com and displays success confirmation', async () => {
    const submitSpy = vi.spyOn(feedbackService, 'submitFeedbackReport').mockResolvedValue({
      success: true,
      message: 'Report sent to AyersAIDev@gmail.com successfully',
      reportId: 'rep_123',
      mailtoUrl: 'mailto:AyersAIDev@gmail.com?subject=Test'
    });

    render(
      <FeedbackModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'u1', email: 'user@test.com' } as any}
        household={{ id: 'h1', name: 'Sunny Kitchen' } as any}
      />
    );

    // Fill in title & description
    fireEvent.change(screen.getByPlaceholderText(/brief summary of the bug/i), {
      target: { value: 'Timer sound is missing on mobile' }
    });
    fireEvent.change(screen.getByPlaceholderText(/describe what happened/i), {
      target: { value: 'When timer hits 0:00, no audio plays on iOS Safari.' }
    });

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /send to ayersaidev@gmail\.com/i }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          title: 'Timer sound is missing on mobile',
          description: 'When timer hits 0:00, no audio plays on iOS Safari.',
          userEmail: 'user@test.com',
          userId: 'u1',
          householdId: 'h1',
          householdName: 'Sunny Kitchen'
        })
      );
      expect(screen.getByText(/report received/i)).toBeTruthy();
      expect(screen.getAllByText(/ayersaidev@gmail\.com/i).length).toBeGreaterThan(0);
    });
  });

  it('allows opening pre-formatted email in personal email client', async () => {
    vi.spyOn(feedbackService, 'submitFeedbackReport').mockResolvedValue({
      success: true,
      message: 'Report sent to AyersAIDev@gmail.com successfully',
      mailtoUrl: 'mailto:AyersAIDev@gmail.com?subject=Test'
    });

    render(
      <FeedbackModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={null}
        household={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/brief summary of the bug/i), {
      target: { value: 'Test bug' }
    });
    fireEvent.change(screen.getByPlaceholderText(/describe what happened/i), {
      target: { value: 'Test description' }
    });

    fireEvent.click(screen.getByRole('button', { name: /send to ayersaidev@gmail\.com/i }));

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /open in email client/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toContain('mailto:AyersAIDev@gmail.com');
    });
  });
});
