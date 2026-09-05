import { describe, it, expect } from 'vitest';
import { 
  saveCalendarPlannerOptions, 
  getStoredCalendarPlannerOptions,
  getDiningOutBalanceRecommendation
} from '../services/calendarService';
import { HouseholdKitchenProfile, CalendarPlannerOptions } from '../types';

describe('Dining Out & Takeout Balancing Settings', () => {
  it('saves and retrieves persistent calendar planner options including busy night dining out', () => {
    const options: CalendarPlannerOptions = {
      autoOmitDiningOut: true,
      prioritizeQuickOnBusy: false,
      suggestEatOutOnPacked: true,
      diningOutBalance: 'busy_nights',
      targetDiningOutCount: 2,
    };

    saveCalendarPlannerOptions(options);
    const loaded = getStoredCalendarPlannerOptions();

    expect(loaded).toBeDefined();
    expect(loaded?.suggestEatOutOnPacked).toBe(true);
    expect(loaded?.diningOutBalance).toBe('busy_nights');
    expect(loaded?.targetDiningOutCount).toBe(2);
  });

  it('determines dining out recommendation for a day based on profile balance mode and calendar busyness', () => {
    const profile: HouseholdKitchenProfile = {
      appliances: [],
      dietaryRestrictions: [],
      dislikedIngredients: [],
      diningOutBalance: 'busy_nights',
      suggestDiningOutOnBusy: true,
      preferredDiningOutDays: ['Friday'],
    };

    // Busy Monday
    const busyMondayResult = getDiningOutBalanceRecommendation(profile, {
      dateStr: '2026-08-31',
      dayName: 'Monday',
      isBusyEvening: true,
      hasDiningOut: false,
      busyEvents: ['Late Board Meeting', 'Soccer Tournament'],
    });

    expect(busyMondayResult.shouldSuggestDiningOut).toBe(true);
    expect(busyMondayResult.reason).toContain('busy evening');

    // Normal Wednesday (should cook)
    const normalWednesdayResult = getDiningOutBalanceRecommendation(profile, {
      dateStr: '2026-09-02',
      dayName: 'Wednesday',
      isBusyEvening: false,
      hasDiningOut: false,
    });

    expect(normalWednesdayResult.shouldSuggestDiningOut).toBe(false);

    // Preferred Friday with balanced mode
    const balancedProfile: HouseholdKitchenProfile = {
      ...profile,
      diningOutBalance: 'balanced',
      maxDiningOutPerWeek: 2,
    };

    const fridayResult = getDiningOutBalanceRecommendation(balancedProfile, {
      dateStr: '2026-09-04',
      dayName: 'Friday',
      isBusyEvening: false,
      hasDiningOut: false,
    });

    expect(fridayResult.shouldSuggestDiningOut).toBe(true);
    expect(fridayResult.reason).toContain('Friday');
  });
});
