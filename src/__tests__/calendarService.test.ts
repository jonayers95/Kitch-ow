import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  classifyCalendarEvent,
  saveCalendarToken,
  getStoredCalendarToken,
  clearStoredCalendarToken,
  fetchUserCalendars,
  fetchWeekCalendarEvents,
  saveSelectedCalendarIds,
  getStoredSelectedCalendarIds,
  saveExportTargetCalendarId,
  getStoredExportTargetCalendarId,
  syncMealPlanToGoogleCalendar,
} from '../services/calendarService';
import { MealPlan, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('calendarService', () => {
  describe('classifyCalendarEvent', () => {
    it('detects dining out events from title keywords', () => {
      const item = {
        id: 'evt_1',
        summary: 'Dinner with Sarah at Osteria',
        start: { dateTime: '2026-08-31T19:00:00Z' },
        end: { dateTime: '2026-08-31T21:00:00Z' },
      };

      const classified = classifyCalendarEvent(item, '2026-08-31');
      expect(classified.isDiningOut).toBe(true);
      expect(classified.summary).toBe('Dinner with Sarah at Osteria');
      expect(classified.isAllDay).toBe(false);
      expect(classified.diningKeywords?.length).toBeGreaterThan(0);
    });

    it('detects dining out events from restaurant keywords in location', () => {
      const item = {
        id: 'evt_2',
        summary: 'Meeting Alex',
        location: 'Luigi\'s Pizzeria',
        start: { dateTime: '2026-08-31T18:30:00Z' },
        end: { dateTime: '2026-08-31T20:00:00Z' },
      };

      const classified = classifyCalendarEvent(item, '2026-08-31');
      expect(classified.isDiningOut).toBe(true);
    });

    it('detects busy evening events from keywords', () => {
      const item = {
        id: 'evt_3',
        summary: 'Kids Soccer Practice',
        start: { dateTime: '2026-08-31T17:30:00' },
        end: { dateTime: '2026-08-31T19:00:00' },
      };

      const classified = classifyCalendarEvent(item, '2026-08-31');
      expect(classified.isBusyEvening).toBe(true);
    });

    it('handles all-day events properly', () => {
      const item = {
        id: 'evt_4',
        summary: 'Family Camping Trip',
        start: { date: '2026-08-31' },
        end: { date: '2026-09-01' },
      };

      const classified = classifyCalendarEvent(item, '2026-08-31');
      expect(classified.isAllDay).toBe(true);
      expect(classified.startTimeFormatted).toBe('All Day');
    });

    it('attaches calendar metadata to classified event when provided', () => {
      const item = {
        id: 'evt_fam_1',
        summary: 'Family Dinner at Grandma',
        start: { dateTime: '2026-08-31T18:00:00Z' },
        end: { dateTime: '2026-08-31T20:00:00Z' },
      };

      const classified = classifyCalendarEvent(item, '2026-08-31', {
        id: 'family_cal_123',
        summary: 'Family',
        backgroundColor: '#7986cb',
      });

      expect(classified.calendarId).toBe('family_cal_123');
      expect(classified.calendarSummary).toBe('Family');
      expect(classified.calendarColor).toBe('#7986cb');
      expect(classified.isDiningOut).toBe(true);
    });
  });

  describe('token and calendar settings storage management', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('stores and retrieves a valid calendar token with user email', () => {
      expect(getStoredCalendarToken().isConnected).toBe(false);

      saveCalendarToken('test_access_token_123', 3600, 'chef@kitchow.com');

      const status = getStoredCalendarToken();
      expect(status.isConnected).toBe(true);
      expect(status.accessToken).toBe('test_access_token_123');
      expect(status.userEmail).toBe('chef@kitchow.com');
    });

    it('clears stored calendar token successfully', () => {
      saveCalendarToken('test_access_token_123', 3600, 'chef@kitchow.com');
      expect(getStoredCalendarToken().isConnected).toBe(true);

      clearStoredCalendarToken();
      expect(getStoredCalendarToken().isConnected).toBe(false);
      expect(getStoredCalendarToken().accessToken).toBeNull();
    });

    it('stores and retrieves selected calendar IDs and export target calendar ID', () => {
      expect(getStoredSelectedCalendarIds()).toBeNull();
      expect(getStoredExportTargetCalendarId()).toBeNull();

      saveSelectedCalendarIds(['primary', 'family_cal_123', 'kids_cal_456']);
      saveExportTargetCalendarId('family_cal_123');

      expect(getStoredSelectedCalendarIds()).toEqual(['primary', 'family_cal_123', 'kids_cal_456']);
      expect(getStoredExportTargetCalendarId()).toBe('family_cal_123');
    });
  });

  describe('fetchUserCalendars', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches list of accessible calendars including Family calendar', async () => {
      const mockCalendarList = {
        items: [
          {
            id: 'primary',
            summary: 'Personal (jonayers95@gmail.com)',
            primary: true,
            selected: true,
            backgroundColor: '#039be5',
          },
          {
            id: 'family_cal_999@group.calendar.google.com',
            summary: 'Family',
            primary: false,
            selected: true,
            backgroundColor: '#33b679',
          },
          {
            id: 'work_cal_888@group.calendar.google.com',
            summary: 'Work Projects',
            primary: false,
            selected: false,
            backgroundColor: '#e67c73',
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCalendarList,
      } as any);

      const calendars = await fetchUserCalendars('mock_token_123');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock_token_123',
          }),
        })
      );

      expect(calendars.length).toBe(3);
      expect(calendars.find((c) => c.summary === 'Family')).toBeDefined();
      expect(calendars.find((c) => c.primary)).toBeDefined();
    });
  });

  describe('fetchWeekCalendarEvents with multi-calendar / Family calendar support', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches and merges events from both primary and Family calendars', async () => {
      // Mock fetch: 1st call for calendarList, 2nd call for primary events, 3rd call for family calendar events
      const fetchSpy = vi.spyOn(global, 'fetch');

      fetchSpy.mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/calendarList')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                { id: 'primary', summary: 'Personal', primary: true, selected: true, backgroundColor: '#039be5' },
                { id: 'family_cal_123', summary: 'Family', primary: false, selected: true, backgroundColor: '#33b679' },
              ],
            }),
          } as any;
        }

        if (urlStr.includes('/calendars/primary/events')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'event_pers_1',
                  summary: 'Lunch with Client at Bistro',
                  start: { dateTime: '2026-08-31T12:30:00Z' },
                  end: { dateTime: '2026-08-31T13:30:00Z' },
                },
              ],
            }),
          } as any;
        }

        if (urlStr.includes('/calendars/family_cal_123/events')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'event_fam_1',
                  summary: 'Family Pizza Night @ Luigi\'s',
                  start: { dateTime: '2026-08-31T18:30:00Z' },
                  end: { dateTime: '2026-08-31T20:00:00Z' },
                },
                {
                  id: 'event_fam_2',
                  summary: 'Kids Soccer Practice',
                  start: { dateTime: '2026-09-01T17:30:00Z' },
                  end: { dateTime: '2026-09-01T19:00:00Z' },
                },
              ],
            }),
          } as any;
        }

        return {
          ok: false,
          status: 404,
          text: async () => 'Not found',
        } as any;
      });

      const insights = await fetchWeekCalendarEvents('2026-08-31', 'test_token_xyz');

      // Aug 31 should have both Personal lunch and Family Pizza night
      const mondayInsights = insights['2026-08-31'];
      expect(mondayInsights).toBeDefined();
      expect(mondayInsights.allEvents.length).toBe(2);
      expect(mondayInsights.hasDiningOut).toBe(true);
      expect(mondayInsights.diningOutEvents.length).toBe(2);

      const familyEvent = mondayInsights.allEvents.find((e) => e.summary.includes('Family Pizza'));
      expect(familyEvent).toBeDefined();
      expect(familyEvent?.calendarSummary).toBe('Family');
      expect(familyEvent?.calendarId).toBe('family_cal_123');

      // Sep 01 should have Kids Soccer Practice from Family calendar
      const tuesdayInsights = insights['2026-09-01'];
      expect(tuesdayInsights).toBeDefined();
      expect(tuesdayInsights.allEvents.length).toBe(1);
      expect(tuesdayInsights.isBusyEvening).toBe(true);
      expect(tuesdayInsights.allEvents[0].summary).toBe('Kids Soccer Practice');
      expect(tuesdayInsights.allEvents[0].calendarSummary).toBe('Family');
    });
  });

  describe('syncMealPlanToGoogleCalendar with custom target calendar', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('exports meals to the designated target calendar (e.g. Family calendar)', async () => {
      const mockRecipe: Recipe = {
        id: 'rec_pasta',
        title: 'Rigatoni Bolognese',
        ingredients: ['rigatoni', 'beef', 'tomato sauce'],
        instructions: ['Boil pasta', 'Simmer sauce'],
        category: 'Dinner',
        authorId: 'user_1',
        householdId: 'hh_1',
        createdAt: Timestamp.now(),
      };

      const recipesMap = new Map<string, Recipe>();
      recipesMap.set('rec_pasta', mockRecipe);

      const mockMealPlan: MealPlan = {
        householdId: 'hh_1',
        weekStartDate: '2026-08-31',
        authorId: 'user_1',
        days: {
          '2026-08-31': [
            {
              id: 'slot_1',
              mealType: 'Dinner',
              recipeId: 'rec_pasta',
            },
          ],
        },
      };

      let postedUrl = '';
      let postedBody: any = null;

      vi.spyOn(global, 'fetch').mockImplementation(async (url: any, options: any) => {
        postedUrl = String(url);
        postedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'new_event_123' }),
        } as any;
      });

      const result = await syncMealPlanToGoogleCalendar(
        mockMealPlan,
        recipesMap,
        'token_123',
        'family_calendar_999@group.calendar.google.com'
      );

      expect(result.addedCount).toBe(1);
      expect(postedUrl).toContain('/calendars/family_calendar_999%40group.calendar.google.com/events');
      expect(postedBody.summary).toContain('Rigatoni Bolognese');
    });
  });
});

