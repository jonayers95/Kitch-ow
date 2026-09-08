import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TARGET_REPORT_EMAIL,
  formatReportEmailBody,
  generateMailtoLink,
  submitFeedbackReport
} from '../services/feedbackService';
import { FeedbackReport } from '../types';

describe('Feedback & Bug Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('targets AyersAIDev@gmail.com as the recipient email', () => {
    expect(TARGET_REPORT_EMAIL).toBe('AyersAIDev@gmail.com');
  });

  it('formats email subject and body correctly for a bug report', () => {
    const report: FeedbackReport = {
      type: 'bug',
      title: 'Recipe ingredients disappear when switching tabs',
      description: 'When I edit a recipe and switch to the meal plan, the list goes blank.',
      severity: 'high',
      reproductionSteps: '1. Open recipe modal\n2. Click meal plan\n3. Return to recipes',
      userEmail: 'chef@example.com',
      userId: 'user_123',
      householdId: 'hh_abc',
      householdName: 'Grandma Kitchen',
      appUrl: 'https://ais-dev.run.app',
      userAgent: 'Mozilla/5.0 Test Browser',
      screenSize: '1920x1080',
      timestamp: '2026-09-08T14:00:00.000Z'
    };

    const formatted = formatReportEmailBody(report);

    expect(formatted.subject).toContain('[BUG - HIGH]');
    expect(formatted.subject).toContain('Recipe ingredients disappear when switching tabs');
    expect(formatted.body).toContain('Type: BUG REPORT');
    expect(formatted.body).toContain('Severity: high');
    expect(formatted.body).toContain('Reporter Email: chef@example.com');
    expect(formatted.body).toContain('Reporter UID: user_123');
    expect(formatted.body).toContain('Household: Grandma Kitchen (hh_abc)');
    expect(formatted.body).toContain('Steps to Reproduce:');
    expect(formatted.body).toContain('1. Open recipe modal');
    expect(formatted.body).toContain('App URL: https://ais-dev.run.app');
    expect(formatted.body).toContain('Zero AI credits/tokens consumed');
  });

  it('formats email subject and body correctly for a feature request', () => {
    const report: FeedbackReport = {
      type: 'feature',
      title: 'Support exporting grocery list to Apple Reminders',
      description: 'I would like an export button for Apple Reminders or iOS Notes.',
      userEmail: 'user@example.com'
    };

    const formatted = formatReportEmailBody(report);

    expect(formatted.subject).toBe('[FEATURE REQUEST] Support exporting grocery list to Apple Reminders');
    expect(formatted.body).toContain('Type: FEATURE REQUEST');
    expect(formatted.body).toContain('Description:\nI would like an export button for Apple Reminders or iOS Notes.');
  });

  it('generates a valid mailto: link addressed to AyersAIDev@gmail.com with encoded components', () => {
    const report: FeedbackReport = {
      type: 'bug',
      title: 'Crash on import',
      description: 'App freezes when entering special characters.'
    };

    const mailto = generateMailtoLink(report);
    expect(mailto.startsWith('mailto:AyersAIDev@gmail.com?')).toBe(true);
    expect(mailto).toContain('subject=');
    expect(mailto).toContain('body=');
  });

  it('rejects submissions missing required title or description', async () => {
    const emptyTitleReport: FeedbackReport = {
      type: 'bug',
      title: '   ',
      description: 'Some description'
    };

    await expect(submitFeedbackReport(emptyTitleReport)).rejects.toThrow(/title/i);

    const emptyDescReport: FeedbackReport = {
      type: 'feature',
      title: 'Nice title',
      description: '   '
    };

    await expect(submitFeedbackReport(emptyDescReport)).rejects.toThrow(/description/i);
  });

  it('submits successfully via /api/feedback without calling any AI models', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Report sent to AyersAIDev@gmail.com successfully',
        reportId: 'rep_123'
      })
    });
    global.fetch = mockFetch;

    const report: FeedbackReport = {
      type: 'bug',
      title: 'Fix grocery sorting',
      description: 'Produce should appear before dairy.',
      severity: 'medium',
      userEmail: 'foodie@example.com'
    };

    const result = await submitFeedbackReport(report);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Fix grocery sorting')
      })
    );
    expect(result.message).toContain('AyersAIDev@gmail.com');
  });

  it('falls back to client mailto generation if server API is unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    global.fetch = mockFetch;

    const report: FeedbackReport = {
      type: 'feature',
      title: 'Add barcode scanner',
      description: 'Scan pantry item UPCs'
    };

    const result = await submitFeedbackReport(report);
    expect(result.success).toBe(true);
    expect(result.mailtoUrl).toBeDefined();
    expect(result.mailtoUrl).toContain('AyersAIDev@gmail.com');
  });
});
