import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoogleCalendarSyncModal } from '../components/GoogleCalendarSyncModal';
import * as calendarService from '../services/calendarService';
import { MealPlan, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('GoogleCalendarSyncModal Component', () => {
  const mockRecipe: Recipe = {
    id: 'rec_1',
    title: 'Garlic Butter Salmon',
    ingredients: ['salmon', 'butter', 'garlic'],
    instructions: ['Sear salmon.'],
    category: 'Dinner',
    authorId: 'user_1',
    householdId: 'hh_1',
    createdAt: Timestamp.now(),
  };

  const mockMealPlan: MealPlan = {
    id: 'mp_1',
    householdId: 'hh_1',
    weekStartDate: '2026-08-31',
    authorId: 'user_1',
    days: {
      '2026-08-31': [
        {
          id: 'slot_1',
          mealType: 'Dinner',
          recipeId: 'rec_1',
        },
      ],
    },
  };

  const mockCalendars = [
    {
      id: 'primary',
      summary: 'Personal (jonayers95@gmail.com)',
      primary: true,
      selected: true,
      backgroundColor: '#039be5',
    },
    {
      id: 'family_cal_123',
      summary: 'Family',
      primary: false,
      selected: true,
      backgroundColor: '#33b679',
    },
  ];

  const mockInsights = {
    '2026-08-31': {
      dateStr: '2026-08-31',
      dayName: 'Monday',
      diningOutEvents: [
        {
          id: 'evt_1',
          summary: 'Family Pizza Night',
          start: { dateTime: '2026-08-31T18:00:00Z' },
          end: { dateTime: '2026-08-31T20:00:00Z' },
          isDiningOut: true,
          calendarId: 'family_cal_123',
          calendarSummary: 'Family',
          calendarColor: '#33b679',
        },
      ],
      busyEveningEvents: [],
      allEvents: [
        {
          id: 'evt_1',
          summary: 'Family Pizza Night',
          start: { dateTime: '2026-08-31T18:00:00Z' },
          end: { dateTime: '2026-08-31T20:00:00Z' },
          isDiningOut: true,
          calendarId: 'family_cal_123',
          calendarSummary: 'Family',
          calendarColor: '#33b679',
        },
      ],
      hasDiningOut: true,
      isBusyEvening: false,
      suggestedAction: 'dining_out' as const,
      suggestionReason: 'Scheduled Dining Out: "Family Pizza Night" [Family]',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <GoogleCalendarSyncModal
        isOpen={false}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={[mockRecipe]}
        weekStartDateKey="2026-08-31"
        weekRangeLabel="Aug 31 - Sep 6"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders connect screen when not authenticated', () => {
    vi.spyOn(calendarService, 'getStoredCalendarToken').mockReturnValue({
      isConnected: false,
      accessToken: null,
    });

    render(
      <GoogleCalendarSyncModal
        isOpen={true}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={[mockRecipe]}
        weekStartDateKey="2026-08-31"
        weekRangeLabel="Aug 31 - Sep 6"
      />
    );

    expect(screen.getByText(/Google Calendar Integration/i)).toBeDefined();
    expect(screen.getByText(/Sign in with Google/i)).toBeDefined();
  });

  it('displays user calendars including Family calendar when connected', async () => {
    vi.spyOn(calendarService, 'getStoredCalendarToken').mockReturnValue({
      isConnected: true,
      accessToken: 'token_abc',
      userEmail: 'jonayers95@gmail.com',
    });
    vi.spyOn(calendarService, 'fetchUserCalendars').mockResolvedValue(mockCalendars);
    vi.spyOn(calendarService, 'fetchWeekCalendarEvents').mockResolvedValue(mockInsights);

    render(
      <GoogleCalendarSyncModal
        isOpen={true}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={[mockRecipe]}
        weekStartDateKey="2026-08-31"
        weekRangeLabel="Aug 31 - Sep 6"
      />
    );

    await waitFor(() => {
      const familyElements = screen.getAllByText(/Family/i);
      expect(familyElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Family Pizza Night/i)).toBeDefined();
    });
  });

  it('allows toggling calendar selection and saves choice', async () => {
    vi.spyOn(calendarService, 'getStoredCalendarToken').mockReturnValue({
      isConnected: true,
      accessToken: 'token_abc',
      userEmail: 'jonayers95@gmail.com',
    });
    vi.spyOn(calendarService, 'fetchUserCalendars').mockResolvedValue(mockCalendars);
    vi.spyOn(calendarService, 'fetchWeekCalendarEvents').mockResolvedValue(mockInsights);
    const saveSpy = vi.spyOn(calendarService, 'saveSelectedCalendarIds');

    render(
      <GoogleCalendarSyncModal
        isOpen={true}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={[mockRecipe]}
        weekStartDateKey="2026-08-31"
        weekRangeLabel="Aug 31 - Sep 6"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Family Pizza Night/i)).toBeDefined();
    });

    const familyButton = screen.getByRole('button', { name: /Family/i });
    fireEvent.click(familyButton);

    expect(saveSpy).toHaveBeenCalled();
  });
});
