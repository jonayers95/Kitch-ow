import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  LogOut, 
  Sparkles, 
  Utensils, 
  Clock, 
  Zap, 
  Loader2, 
  Share2,
  CalendarCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getStoredCalendarToken, 
  requestGoogleCalendarAccess, 
  clearStoredCalendarToken, 
  fetchWeekCalendarEvents, 
  syncMealPlanToGoogleCalendar,
  CalendarAuthStatus 
} from '../services/calendarService';
import { MealPlan, Recipe, WeekCalendarInsights } from '../types';

interface GoogleCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: MealPlan | null;
  recipes: Recipe[];
  weekStartDateKey: string;
  weekRangeLabel: string;
  onCalendarUpdated?: () => void;
}

export const GoogleCalendarSyncModal: React.FC<GoogleCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  mealPlan,
  recipes,
  weekStartDateKey,
  weekRangeLabel,
  onCalendarUpdated,
}) => {
  const [authStatus, setAuthStatus] = useState<CalendarAuthStatus>({ isConnected: false, accessToken: null });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendarInsights, setCalendarInsights] = useState<WeekCalendarInsights | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncSuccessResult, setSyncSuccessResult] = useState<{ count: number } | null>(null);

  // Check auth on open
  useEffect(() => {
    if (isOpen) {
      const status = getStoredCalendarToken();
      setAuthStatus(status);
      setErrorMessage(null);
      setSyncSuccessResult(null);

      if (status.isConnected && status.accessToken) {
        loadEvents(status.accessToken);
      }
    }
  }, [isOpen, weekStartDateKey]);

  const loadEvents = async (token?: string) => {
    setIsLoadingEvents(true);
    setErrorMessage(null);
    try {
      const insights = await fetchWeekCalendarEvents(weekStartDateKey, token);
      setCalendarInsights(insights);
      if (onCalendarUpdated) onCalendarUpdated();
    } catch (err: any) {
      console.warn("Error fetching calendar events:", err);
      setErrorMessage(err?.message || "Failed to load events from Google Calendar.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const { accessToken, email } = await requestGoogleCalendarAccess();
      setAuthStatus({ isConnected: true, accessToken, userEmail: email });
      await loadEvents(accessToken);
      if (onCalendarUpdated) onCalendarUpdated();
    } catch (err: any) {
      console.error("Google Calendar connection error:", err);
      setErrorMessage(err?.message || "Failed to authenticate with Google Calendar. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredCalendarToken();
    setAuthStatus({ isConnected: false, accessToken: null });
    setCalendarInsights(null);
    setSyncSuccessResult(null);
    if (onCalendarUpdated) onCalendarUpdated();
  };

  const handleExportToGoogleCalendar = async () => {
    if (!mealPlan) return;
    setIsSyncing(true);
    setErrorMessage(null);
    setSyncSuccessResult(null);

    try {
      const recipeMap = new Map<string, Recipe>();
      recipes.forEach((r) => {
        if (r.id) recipeMap.set(r.id, r);
      });

      const result = await syncMealPlanToGoogleCalendar(mealPlan, recipeMap);
      if (result.addedCount > 0) {
        setSyncSuccessResult({ count: result.addedCount });
      } else if (result.errors.length > 0) {
        setErrorMessage(`Could not export some events: ${result.errors[0]}`);
      } else {
        setErrorMessage("No planned meals found to export for this week.");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setErrorMessage(err?.message || "Failed to export meal plan to Google Calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const totalPlannedMeals = mealPlan?.days 
    ? Object.values(mealPlan.days).reduce((acc, slots) => acc + slots.length, 0)
    : 0;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                  Google Calendar Integration
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Detect dining out, avoid dinner conflicts, and sync your weekly plan
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {errorMessage && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <p className="font-semibold">{errorMessage}</p>
                </div>
              </div>
            )}

            {syncSuccessResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-bold">Successfully Exported!</p>
                  <p className="mt-0.5">
                    Synced {syncSuccessResult.count} meals to your Google Calendar. You'll now see your recipes and cook times directly in your daily agenda.
                  </p>
                </div>
              </div>
            )}

            {/* Connection Status Card */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${authStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'}`} />
                  <div>
                    <h4 className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100">
                      {authStatus.isConnected ? 'Google Account Connected' : 'Connect Google Calendar'}
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {authStatus.isConnected && authStatus.userEmail
                        ? `Linked as ${authStatus.userEmail}`
                        : 'Allow Kitch-ow! to read upcoming events & detect meal conflicts'}
                    </p>
                  </div>
                </div>

                <div>
                  {authStatus.isConnected ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadEvents()}
                        disabled={isLoadingEvents}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 transition-colors flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Authorizing...
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="w-4 h-4" />
                          Sign in with Google
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Feature capabilities list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-stone-200/60 dark:border-stone-700/60 text-xs text-stone-600 dark:text-stone-300">
                <div className="flex items-start gap-2">
                  <span className="text-base">🍷</span>
                  <div>
                    <strong className="block text-stone-800 dark:text-stone-200">Dining Out Radar</strong>
                    <span className="text-[11px] text-stone-500">Auto-detects restaurant dates & omit dinners</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base">⚡</span>
                  <div>
                    <strong className="block text-stone-800 dark:text-stone-200">Busy Evenings</strong>
                    <span className="text-[11px] text-stone-500">Prioritizes 15-20m quick meals on packed nights</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base">📅</span>
                  <div>
                    <strong className="block text-stone-800 dark:text-stone-200">2-Way Sync</strong>
                    <span className="text-[11px] text-stone-500">Push dinner plans & cook times to Google Calendar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Insights for the Week */}
            {authStatus.isConnected && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Detected Schedule Insights ({weekRangeLabel})
                  </h4>
                  {isLoadingEvents && (
                    <span className="text-[11px] text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Scanning calendar...
                    </span>
                  )}
                </div>

                {calendarInsights ? (
                  <div className="space-y-2">
                    {Object.values(calendarInsights).map((day) => {
                      const hasEvents = day.allEvents.length > 0;
                      return (
                        <div
                          key={day.dateStr}
                          className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            day.hasDiningOut
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
                              : day.isBusyEvening
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80'
                              : 'bg-white dark:bg-stone-850 border-stone-200/80 dark:border-stone-800'
                          }`}
                        >
                          <div className="sm:w-36 flex-shrink-0">
                            <span className="font-serif font-bold text-xs text-stone-900 dark:text-stone-100 block">
                              {day.dayName}
                            </span>
                            <span className="text-[11px] text-stone-400">
                              {day.dateStr}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {day.hasDiningOut ? (
                              <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-semibold">
                                <span className="text-base">🍷</span>
                                <span className="truncate">
                                  Dining Out: {day.diningOutEvents.map(e => e.summary).join(', ')}
                                </span>
                              </div>
                            ) : day.isBusyEvening ? (
                              <div className="flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
                                <span className="text-base">⚡</span>
                                <span className="truncate">
                                  Busy Evening: {day.busyEveningEvents.map(e => e.summary).join(', ')}
                                </span>
                              </div>
                            ) : hasEvents ? (
                              <div className="text-xs text-stone-600 dark:text-stone-400">
                                {day.allEvents.length} event{day.allEvents.length === 1 ? '' : 's'} scheduled (open for normal cooking)
                              </div>
                            ) : (
                              <div className="text-xs text-stone-400 italic">
                                Free schedule — great day for leisurely cooking
                              </div>
                            )}
                          </div>

                          {day.suggestedAction === 'dining_out' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 self-start sm:self-auto">
                              Omit Dinner
                            </span>
                          )}
                          {day.suggestedAction === 'quick_meal' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 self-start sm:self-auto">
                              Quick Meal (~20m)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-stone-400 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                    Click "Refresh" above to load this week's events.
                  </div>
                )}
              </div>
            )}

            {/* Sync Meal Plan to Google Calendar */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-200 dark:border-blue-800/60 space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100">
                  Export Meal Plan to Google Calendar
                </h4>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Push all {totalPlannedMeals} scheduled recipes, cook times, and meal notes for the week of <strong>{weekRangeLabel}</strong> to your primary Google Calendar.
              </p>

              <button
                onClick={handleExportToGoogleCalendar}
                disabled={!authStatus.isConnected || isSyncing || totalPlannedMeals === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Exporting {totalPlannedMeals} Meals...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-4 h-4" />
                    Sync {totalPlannedMeals} Planned Meals to Calendar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end bg-stone-50/50 dark:bg-stone-900/50">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
