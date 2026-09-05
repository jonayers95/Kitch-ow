import { Timestamp } from 'firebase/firestore';

export type Category = "Breakfast" | "Lunch" | "Dinner" | "Dessert" | "Snack" | "Drink" | "Other";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";

export interface MealSlot {
  id: string;
  mealType: MealType;
  recipeId?: string;
  customTitle?: string;
  notes?: string;
  isDone?: boolean;
  isDiningOut?: boolean;
  diningOutPlace?: string;
  calendarEventId?: string;
  calendarEventSummary?: string;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  isAllDay?: boolean;
  isDiningOut?: boolean;
  isBusyEvening?: boolean;
  diningKeywords?: string[];
  busyKeywords?: string[];
  startTimeFormatted?: string;
  endTimeFormatted?: string;
  calendarId?: string;
  calendarSummary?: string;
  calendarColor?: string;
}

export interface DayCalendarInsights {
  dateStr: string;
  dayName: string;
  diningOutEvents: GoogleCalendarEvent[];
  busyEveningEvents: GoogleCalendarEvent[];
  allEvents: GoogleCalendarEvent[];
  hasDiningOut: boolean;
  isBusyEvening: boolean;
  suggestedAction?: 'dining_out' | 'quick_meal' | 'normal';
  suggestionReason?: string;
}

export interface WeekCalendarInsights {
  [dateStr: string]: DayCalendarInsights;
}

export type DiningOutBalanceMode = 'always_cook' | 'busy_nights' | 'balanced' | 'frequent';

export interface CalendarPlannerOptions {
  autoOmitDiningOut: boolean;
  prioritizeQuickOnBusy: boolean;
  suggestEatOutOnPacked: boolean;
  diningOutBalance?: DiningOutBalanceMode;
  targetDiningOutCount?: number;
}

export interface MealPlan {
  id?: string;
  householdId: string;
  weekStartDate: string; // Format: YYYY-MM-DD
  days: {
    [dateStr: string]: MealSlot[];
  };
  authorId: string;
  updatedAt?: Timestamp;
}

export interface Recipe {
  id?: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  category: Category;
  rating?: number;
  estimatedTime?: number | null;
  authorId: string;
  householdId: string;
  sourceUrl?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  isStock?: boolean;
  isStaple?: boolean;
}

export interface HouseholdKitchenProfile {
  appliances: string[];
  customAppliances?: string;
  dietaryRestrictions: string[];
  customDietaryRestrictions?: string;
  dislikedIngredients: string[];
  customDislikedIngredients?: string;
  defaultServings?: number;
  notes?: string;
  diningOutBalance?: DiningOutBalanceMode;
  suggestDiningOutOnBusy?: boolean;
  maxDiningOutPerWeek?: number;
  preferredDiningOutDays?: string[];
  diningOutCustomNotes?: string;
}

export interface Household {
  id?: string;
  name: string;
  ownerId: string;
  members: { [userId: string]: 'admin' | 'member' | 'viewer' };
  createdAt?: Timestamp;
  isStock?: boolean;
  kitchenProfile?: HouseholdKitchenProfile;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
