import { GoogleCalendarEvent, DayCalendarInsights, WeekCalendarInsights, MealPlan, Recipe, GoogleCalendarListItem, CalendarPlannerOptions, HouseholdKitchenProfile } from '../types';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const TOKEN_KEY = 'kitchow_gcal_token';
const EXPIRY_KEY = 'kitchow_gcal_token_expires_at';
const EMAIL_KEY = 'kitchow_gcal_user_email';
const SELECTED_CALENDARS_KEY = 'kitchow_gcal_selected_calendars';
const EXPORT_TARGET_CALENDAR_KEY = 'kitchow_gcal_export_target_calendar';
const PLANNER_OPTIONS_KEY = 'kitchow_calendar_planner_options';

export interface CalendarAuthStatus {
  isConnected: boolean;
  accessToken: string | null;
  userEmail?: string | null;
  expiresAt?: number | null;
}

// Comprehensive Dining-Out Keyword Matchers
const DINING_OUT_REGEX = /\b(dinner|lunch|brunch|supper|restaurant|bistro|osteria|trattoria|grill|cafe|café|tavern|pub|bbq|barbecue|steakhouse|pizzeria|pizza|sushi|tapas|taqueria|cantina|ramen|izakaya|bakery|diner|eatery|buffet|takeout|take-out|take out|reservation|reservations|eat out|eating out|dining out|food truck|happy hour|cocktails|drinks with|drinks @|drinks at|potluck|date night|anniversary dinner|birthday dinner|rehearsal dinner|banquet|catering|team lunch|team dinner|family dinner|farewell dinner)\b/i;

// Busy Evening Keyword Matchers
const BUSY_EVENING_REGEX = /\b(practice|tournament|game|match|recital|concert|flight|airport|travel|late meeting|overtime|rehearsal|conference|gala|theater|theatre|show|movie|cinema|scouts|swim meet|soccer|baseball|basketball|football|hockey|gymnastics|ballet|dance class|workout|overtime|shift|on call|doctor|dentist|appointment|parent teacher|pta meeting)\b/i;

export function getStoredCalendarToken(): CalendarAuthStatus {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryStr = localStorage.getItem(EXPIRY_KEY);
    const email = localStorage.getItem(EMAIL_KEY);

    if (!token) {
      return { isConnected: false, accessToken: null };
    }

    if (expiryStr) {
      const expiresAt = parseInt(expiryStr, 10);
      if (Date.now() > expiresAt) {
        // Expired
        clearStoredCalendarToken();
        return { isConnected: false, accessToken: null };
      }
      return { isConnected: true, accessToken: token, userEmail: email, expiresAt };
    }

    return { isConnected: true, accessToken: token, userEmail: email };
  } catch (err) {
    console.error("Error reading stored calendar token:", err);
    return { isConnected: false, accessToken: null };
  }
}

export function saveCalendarToken(token: string, expiresInSeconds: number = 3600, email?: string): void {
  try {
    const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, expiresAt.toString());
    if (email) {
      localStorage.setItem(EMAIL_KEY, email);
    }
  } catch (err) {
    console.error("Error saving calendar token:", err);
  }
}

export function clearStoredCalendarToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch (err) {
    console.error("Error clearing calendar token:", err);
  }
}

export function saveSelectedCalendarIds(calendarIds: string[]): void {
  try {
    localStorage.setItem(SELECTED_CALENDARS_KEY, JSON.stringify(calendarIds));
  } catch (err) {
    console.error("Error saving selected calendar IDs:", err);
  }
}

export function getStoredSelectedCalendarIds(): string[] | null {
  try {
    const data = localStorage.getItem(SELECTED_CALENDARS_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading selected calendar IDs:", err);
    return null;
  }
}

export function saveExportTargetCalendarId(calendarId: string): void {
  try {
    localStorage.setItem(EXPORT_TARGET_CALENDAR_KEY, calendarId);
  } catch (err) {
    console.error("Error saving export target calendar ID:", err);
  }
}

export function getStoredExportTargetCalendarId(): string | null {
  try {
    return localStorage.getItem(EXPORT_TARGET_CALENDAR_KEY);
  } catch (err) {
    console.error("Error reading export target calendar ID:", err);
    return null;
  }
}

export function saveCalendarPlannerOptions(options: CalendarPlannerOptions): void {
  try {
    localStorage.setItem(PLANNER_OPTIONS_KEY, JSON.stringify(options));
  } catch (err) {
    console.error("Error saving calendar planner options:", err);
  }
}

export function getStoredCalendarPlannerOptions(): CalendarPlannerOptions | null {
  try {
    const data = localStorage.getItem(PLANNER_OPTIONS_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading calendar planner options:", err);
    return null;
  }
}

export interface DiningOutRecommendation {
  shouldSuggestDiningOut: boolean;
  reason: string;
  suggestedPlaceOrStyle?: string;
}

export function getDiningOutBalanceRecommendation(
  profile?: HouseholdKitchenProfile | null,
  dayInfo?: {
    dateStr: string;
    dayName: string;
    isBusyEvening?: boolean;
    hasDiningOut?: boolean;
    busyEvents?: string[];
  }
): DiningOutRecommendation {
  if (!dayInfo) {
    return { shouldSuggestDiningOut: false, reason: '' };
  }

  // If already marked as dining out in calendar
  if (dayInfo.hasDiningOut) {
    return {
      shouldSuggestDiningOut: true,
      reason: 'Scheduled Google Calendar dining out plan',
      suggestedPlaceOrStyle: 'Reserved Event',
    };
  }

  const balanceMode = profile?.diningOutBalance || (profile?.suggestDiningOutOnBusy ? 'busy_nights' : 'always_cook');

  // Case 1: Auto-relief on busy evenings (User setting: "Suggest dining out if the week is too busy")
  if ((balanceMode === 'busy_nights' || balanceMode === 'balanced' || balanceMode === 'frequent' || profile?.suggestDiningOutOnBusy) && dayInfo.isBusyEvening) {
    const eventSummary = dayInfo.busyEvents?.length ? dayInfo.busyEvents.slice(0, 2).join(', ') : 'packed evening';
    return {
      shouldSuggestDiningOut: true,
      reason: `Automated relief for busy evening (${eventSummary}) — enjoy takeout or dining out instead of cooking`,
      suggestedPlaceOrStyle: profile?.diningOutCustomNotes || 'Takeout / Local Favorite',
    };
  }

  // Case 2: Preferred dining out days (e.g., Friday date night or weekend break)
  if (balanceMode === 'balanced' || balanceMode === 'frequent') {
    const preferredDays = profile?.preferredDiningOutDays && profile.preferredDiningOutDays.length > 0 
      ? profile.preferredDiningOutDays 
      : ['Friday'];

    if (preferredDays.includes(dayInfo.dayName)) {
      return {
        shouldSuggestDiningOut: true,
        reason: `Planned weekly balance: Designated dining out / takeout on ${dayInfo.dayName}`,
        suggestedPlaceOrStyle: profile?.diningOutCustomNotes || 'Dining Out / Takeout Night',
      };
    }
  }

  return {
    shouldSuggestDiningOut: false,
    reason: '',
  };
}

export async function requestGoogleCalendarAccess(): Promise<{ accessToken: string; email?: string }> {
  // First attempt: Use Firebase GoogleAuthProvider with Workspace scopes via signInWithPopup
  try {
    const calendarProvider = new GoogleAuthProvider();
    calendarProvider.addScope('https://www.googleapis.com/auth/calendar.events');
    calendarProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    calendarProvider.setCustomParameters({ prompt: 'consent' });

    const result = await signInWithPopup(auth, calendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      const accessToken = credential.accessToken;
      const email = result.user?.email || undefined;
      saveCalendarToken(accessToken, 3600, email);
      return { accessToken, email };
    }
  } catch (firebaseErr: any) {
    console.warn("Firebase popup sign-in with calendar scope failed, attempting GSI fallback:", firebaseErr);
    // If user closed popup intentionally, rethrow
    if (firebaseErr?.code === 'auth/popup-closed-by-user' || firebaseErr?.code === 'auth/cancelled-popup-request') {
      throw new Error("Calendar connection was cancelled.");
    }
  }

  // Second attempt: Fallback to Google Identity Services (GSI) initTokenClient
  return new Promise(async (resolve, reject) => {
    try {
      let clientId = (firebaseConfig as any)?.oAuthClientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (window as any).GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        try {
          const res = await fetch('/api/auth/google/client-id');
          if (res.ok) {
            const data = await res.json();
            clientId = data.clientId;
          }
        } catch (e) {
          console.warn("Could not retrieve client ID from /api/auth/google/client-id:", e);
        }
      }

      if (!clientId) {
        clientId = (firebaseConfig as any)?.oAuthClientId || "465204536443-e0to8keafksl66fs2vahbe8cqi6la6bd.apps.googleusercontent.com";
      }

      // Check for Google GSI client library
      if (!(window as any).google?.accounts?.oauth2) {
        return reject(new Error("Google Identity Services library is not loaded. Please ensure your internet connection is active and reload the page."));
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(`OAuth Error: ${tokenResponse.error_description || tokenResponse.error}`));
          }
          if (!tokenResponse.access_token) {
            return reject(new Error("No access token returned from Google."));
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;

          // Attempt to retrieve user info for friendly display
          let userEmail: string | undefined;
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              userEmail = uData.email;
            }
          } catch (ue) {
            console.warn("Could not fetch Google user profile email:", ue);
          }

          saveCalendarToken(accessToken, expiresIn, userEmail);
          resolve({ accessToken, email: userEmail });
        },
        error_callback: (err: any) => {
          reject(new Error(`OAuth Request failed: ${err?.message || JSON.stringify(err)}`));
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Fetch all accessible Google Calendars for the user (including primary, Family, Work, etc.)
 */
export async function fetchUserCalendars(token?: string): Promise<GoogleCalendarListItem[]> {
  const currentToken = token || getStoredCalendarToken().accessToken;
  if (!currentToken) {
    throw new Error("Google Calendar is not connected.");
  }

  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      Authorization: `Bearer ${currentToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    clearStoredCalendarToken();
    throw new Error("Google Calendar session expired. Please reconnect your Google account.");
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch Google calendars list (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const items: any[] = data.items || [];

  return items.map((cal) => ({
    id: cal.id,
    summary: cal.summaryOverride || cal.summary || 'Untitled Calendar',
    description: cal.description || undefined,
    primary: !!cal.primary,
    selected: cal.selected !== undefined ? cal.selected : true,
    backgroundColor: cal.backgroundColor || '#039be5',
    foregroundColor: cal.foregroundColor || '#ffffff',
    accessRole: cal.accessRole,
  }));
}

function parseTimeStr(dateTimeStr?: string): { hour: number; minute: number; formatted: string } | null {
  if (!dateTimeStr) return null;
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return null;
    const hour = d.getHours();
    const minute = d.getMinutes();
    const formatted = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { hour, minute, formatted };
  } catch {
    return null;
  }
}

export function classifyCalendarEvent(
  item: any,
  dateKey: string,
  calendarMeta?: { id?: string; summary?: string; backgroundColor?: string }
): GoogleCalendarEvent {
  const summary = (item.summary || "").trim();
  const description = (item.description || "").trim();
  const location = (item.location || "").trim();
  const fullText = `${summary} ${description} ${location}`;

  const isAllDay = !item.start?.dateTime && !!item.start?.date;
  const startParsed = parseTimeStr(item.start?.dateTime);
  const endParsed = parseTimeStr(item.end?.dateTime);

  const diningMatches: string[] = [];
  const busyMatches: string[] = [];

  // Check Dining Out
  const diningSearch = fullText.match(DINING_OUT_REGEX);
  let isDiningOut = false;
  if (diningSearch) {
    isDiningOut = true;
    diningMatches.push(diningSearch[0].toLowerCase());
  }

  // Check Busy / Late Evening
  let isBusyEvening = false;
  const busySearch = fullText.match(BUSY_EVENING_REGEX);
  if (busySearch) {
    busyMatches.push(busySearch[0].toLowerCase());
  }

  // If event takes place between 4:30 PM (16.5) and 9:30 PM (21.5), consider it an evening activity
  if (startParsed && startParsed.hour >= 16 && startParsed.hour <= 21) {
    isBusyEvening = true;
    busyMatches.push(`Evening activity at ${startParsed.formatted}`);
  } else if (endParsed && endParsed.hour >= 18) {
    isBusyEvening = true;
    busyMatches.push(`Ends late at ${endParsed.formatted}`);
  }

  return {
    id: item.id || `cal_${Math.random().toString(36).substring(2, 9)}`,
    summary: summary || "Scheduled Event",
    description: description || undefined,
    location: location || undefined,
    start: item.start || { date: dateKey },
    end: item.end || { date: dateKey },
    htmlLink: item.htmlLink || undefined,
    isAllDay,
    isDiningOut,
    isBusyEvening,
    diningKeywords: diningMatches,
    busyKeywords: busyMatches,
    startTimeFormatted: startParsed?.formatted || (isAllDay ? 'All Day' : undefined),
    endTimeFormatted: endParsed?.formatted,
    calendarId: calendarMeta?.id,
    calendarSummary: calendarMeta?.summary,
    calendarColor: calendarMeta?.backgroundColor,
  };
}

export async function fetchWeekCalendarEvents(
  weekStartDateKey: string,
  token?: string,
  calendarIds?: string[]
): Promise<WeekCalendarInsights> {
  const currentToken = token || getStoredCalendarToken().accessToken;
  if (!currentToken) {
    throw new Error("Google Calendar is not connected. Please connect your Google account.");
  }

  // Determine which calendars to fetch
  let targetCalendars: { id: string; summary?: string; backgroundColor?: string }[] = [];

  if (calendarIds && calendarIds.length > 0) {
    targetCalendars = calendarIds.map((id) => ({ id }));
  } else {
    // Check saved selected calendar IDs or discover all user calendars (including Family)
    const savedIds = getStoredSelectedCalendarIds();
    try {
      const allCalendars = await fetchUserCalendars(currentToken);
      if (savedIds && savedIds.length > 0) {
        targetCalendars = allCalendars
          .filter((c) => savedIds.includes(c.id))
          .map((c) => ({ id: c.id, summary: c.summary, backgroundColor: c.backgroundColor }));
      } else {
        // By default, query all user calendars so Family, Work, Personal are all included seamlessly
        targetCalendars = allCalendars.map((c) => ({
          id: c.id,
          summary: c.summary,
          backgroundColor: c.backgroundColor,
        }));
      }
    } catch (listErr) {
      console.warn("Could not list Google calendars, falling back to primary:", listErr);
      if (savedIds && savedIds.length > 0) {
        targetCalendars = savedIds.map((id) => ({ id }));
      } else {
        targetCalendars = [{ id: 'primary', summary: 'Primary' }];
      }
    }
  }

  if (targetCalendars.length === 0) {
    targetCalendars = [{ id: 'primary', summary: 'Primary' }];
  }

  // Calculate Monday 00:00:00 to Sunday 23:59:59 in ISO format
  const [y, m, d] = weekStartDateKey.split('-').map(Number);
  const startMonday = new Date(y, m - 1, d, 0, 0, 0);
  const endSunday = new Date(y, m - 1, d + 6, 23, 59, 59, 999);

  const timeMin = startMonday.toISOString();
  const timeMax = endSunday.toISOString();

  // Fetch events for all targeted calendars concurrently
  const calendarEventFetches = targetCalendars.map(async (cal) => {
    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 401) {
        clearStoredCalendarToken();
        throw new Error("Google Calendar session expired. Please reconnect your Google account.");
      }

      if (!response.ok) {
        console.warn(`Could not fetch events for calendar ${cal.id} (${response.status})`);
        return [];
      }

      const data = await response.json();
      const rawItems: any[] = data.items || [];
      return rawItems.map((item) => ({ item, calendarMeta: cal }));
    } catch (err: any) {
      console.warn(`Error fetching events for calendar ${cal.id}:`, err);
      return [];
    }
  });

  const calendarResults = await Promise.all(calendarEventFetches);
  const allRawItemsWithMeta = calendarResults.flat();

  // Generate 7 days mapping
  const result: WeekCalendarInsights = {};

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(y, m - 1, d + i);
    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

    result[dateStr] = {
      dateStr,
      dayName,
      diningOutEvents: [],
      busyEveningEvents: [],
      allEvents: [],
      hasDiningOut: false,
      isBusyEvening: false,
    };
  }

  // Deduplicate and group events into appropriate days
  const seenEventIds = new Set<string>();

  allRawItemsWithMeta.forEach(({ item, calendarMeta }) => {
    const eventId = item.id || `${item.summary}_${item.start?.dateTime || item.start?.date}`;
    if (seenEventIds.has(eventId)) return;
    seenEventIds.add(eventId);

    let eventDateKey = "";
    if (item.start?.dateTime) {
      const dt = new Date(item.start.dateTime);
      if (!isNaN(dt.getTime())) {
        eventDateKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    } else if (item.start?.date) {
      eventDateKey = item.start.date;
    }

    if (result[eventDateKey]) {
      const classified = classifyCalendarEvent(item, eventDateKey, calendarMeta);
      result[eventDateKey].allEvents.push(classified);

      if (classified.isDiningOut) {
        result[eventDateKey].diningOutEvents.push(classified);
        result[eventDateKey].hasDiningOut = true;
      }

      if (classified.isBusyEvening) {
        result[eventDateKey].busyEveningEvents.push(classified);
        result[eventDateKey].isBusyEvening = true;
      }
    }
  });

  // Calculate high-level suggestions for each day
  Object.values(result).forEach((day) => {
    if (day.hasDiningOut) {
      day.suggestedAction = 'dining_out';
      const firstDining = day.diningOutEvents[0];
      const sourceTag = firstDining.calendarSummary ? ` [${firstDining.calendarSummary}]` : '';
      day.suggestionReason = `Scheduled Dining Out: "${firstDining.summary}"${sourceTag}${firstDining.startTimeFormatted ? ` @ ${firstDining.startTimeFormatted}` : ''}`;
    } else if (day.isBusyEvening || day.allEvents.length >= 3) {
      day.suggestedAction = 'quick_meal';
      const busySummary = day.busyEveningEvents.map(e => e.summary).slice(0, 2).join(", ");
      day.suggestionReason = `Busy evening schedule (${busySummary || `${day.allEvents.length} events`}) — quick 15-20 min meal or easy takeout recommended`;
    } else {
      day.suggestedAction = 'normal';
      day.suggestionReason = undefined;
    }
  });

  return result;
}

export async function syncMealPlanToGoogleCalendar(
  mealPlan: MealPlan,
  recipesMap: Map<string, Recipe>,
  token?: string,
  targetCalendarId: string = 'primary'
): Promise<{ addedCount: number; errors: string[] }> {
  const currentToken = token || getStoredCalendarToken().accessToken;
  if (!currentToken) {
    throw new Error("Google Calendar is not connected. Please connect your Google account first.");
  }

  let addedCount = 0;
  const errors: string[] = [];

  const mealTimes: { [mealType: string]: { startHour: number; endHour: number } } = {
    Breakfast: { startHour: 8, endHour: 9 },
    Lunch: { startHour: 12, endHour: 13 },
    Dinner: { startHour: 18, endHour: 19 },
    Snack: { startHour: 15, endHour: 16 },
    Dessert: { startHour: 20, endHour: 21 },
  };

  const daysEntries = Object.entries(mealPlan.days || {});

  for (const [dateStr, slots] of daysEntries) {
    if (!Array.isArray(slots)) continue;
    const [year, month, day] = dateStr.split('-').map(Number);

    for (const slot of slots) {
      if (!slot) continue;
      
      const recipe = slot.recipeId ? recipesMap.get(slot.recipeId) : null;
      const title = slot.customTitle || recipe?.title || (slot.isDiningOut ? (slot.diningOutPlace || "Dining Out") : "Planned Meal");
      
      if (!title || title === "Planned Meal") continue;

      const timeConfig = mealTimes[slot.mealType] || { startHour: 18, endHour: 19 };
      const startDateTime = new Date(year, month - 1, day, timeConfig.startHour, 0, 0);
      const endDateTime = new Date(year, month - 1, day, timeConfig.endHour, 0, 0);

      const descriptionLines = [
        `🍳 Kitch-ow! Planned ${slot.mealType}`,
        `🍽️ Recipe: ${title}`,
      ];

      if (recipe?.estimatedTime) {
        descriptionLines.push(`⏱️ Estimated Prep/Cook Time: ${recipe.estimatedTime} mins`);
      }
      if (recipe?.category) {
        descriptionLines.push(`📂 Category: ${recipe.category}`);
      }
      if (slot.notes) {
        descriptionLines.push(`📝 Notes: ${slot.notes}`);
      }
      if (slot.isDiningOut) {
        descriptionLines.push(`🍷 Scheduled as Dining Out / Restaurant Meal`);
      }

      const eventPayload = {
        summary: slot.isDiningOut ? `🍷 Dining Out: ${title}` : `🍽️ ${slot.mealType}: ${title}`,
        description: descriptionLines.join("\n"),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        colorId: slot.isDiningOut ? '11' : (slot.mealType === 'Dinner' ? '5' : '2'), // Distinct Google Calendar color
      };

      try {
        const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        });

        if (createRes.ok) {
          addedCount++;
        } else {
          const errText = await createRes.text();
          errors.push(`Failed on ${dateStr} ${slot.mealType}: ${errText}`);
        }
      } catch (err: any) {
        errors.push(`Failed on ${dateStr} ${slot.mealType}: ${err?.message || err}`);
      }
    }
  }

  return { addedCount, errors };
}

