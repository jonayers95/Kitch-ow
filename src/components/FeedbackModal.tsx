import React, { useState, useEffect, useRef } from 'react';
import { 
  Bug, 
  Lightbulb, 
  MessageSquare, 
  Send, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Mail, 
  CheckCircle2, 
  ExternalLink,
  Laptop,
  Sparkles,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FeedbackReport, ReportSeverity, ReportType, Household } from '../types';
import { submitFeedbackReport, TARGET_REPORT_EMAIL } from '../services/feedbackService';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { uid?: string; email?: string | null; displayName?: string | null } | null;
  household?: Household | null;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  household,
}) => {
  const [type, setType] = useState<ReportType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ReportSeverity>('medium');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ message: string; mailtoUrl?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser?.email) {
      setUserEmail(currentUser.email);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setTimeout(() => {
        setSubmitSuccess(false);
        setSuccessInfo(null);
        setErrorMessage(null);
        setTitle('');
        setDescription('');
        setReproductionSteps('');
        setCopiedLink(false);
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage('Please provide both a title and description.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const report: FeedbackReport = {
      type,
      title: title.trim(),
      description: description.trim(),
      severity: type === 'bug' ? severity : undefined,
      reproductionSteps: type === 'bug' ? reproductionSteps.trim() : undefined,
      userEmail: userEmail.trim() || currentUser?.email || undefined,
      userId: currentUser?.uid || undefined,
      householdId: household?.id || undefined,
      householdName: household?.name || undefined,
      appUrl: includeDiagnostics && typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: includeDiagnostics && typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      screenSize: includeDiagnostics && typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    };

    try {
      const res = await submitFeedbackReport(report);
      setSubmitSuccess(true);
      setSuccessInfo({
        message: res.message,
        mailtoUrl: res.mailtoUrl,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit report. Please try again or open your email client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyEmailAddress = () => {
    navigator.clipboard.writeText(TARGET_REPORT_EMAIL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div 
      id="feedback-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <motion.div
        ref={modalRef}
        id="feedback-modal"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between gap-4 bg-stone-50/70 dark:bg-stone-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {type === 'bug' ? <Bug className="w-5 h-5" /> : type === 'feature' ? <Lightbulb className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Report a Bug or Request a Feature
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Direct transmission to <strong className="font-semibold text-stone-800 dark:text-stone-200">{TARGET_REPORT_EMAIL}</strong>.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <span>Zero AI credits / tokens consumed</span>
            </div>
          </div>

          <button
            id="feedback-modal-close-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {submitSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Report Received!
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                  Your report has been logged and sent to <strong className="font-semibold text-stone-800 dark:text-stone-200">{TARGET_REPORT_EMAIL}</strong> for review.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300 text-left space-y-2">
                <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-[11px]">
                  <span>Recipient:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-stone-800 dark:text-stone-200">{TARGET_REPORT_EMAIL}</span>
                    <button
                      type="button"
                      onClick={handleCopyEmailAddress}
                      className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-0.5"
                      title="Copy email address"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-stone-400">
                  You can also open this report directly in your default email application if you wish to attach screenshots or additional diagnostics.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                {successInfo?.mailtoUrl && (
                  <a
                    href={successInfo.mailtoUrl}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-amber-500" />
                    <span>Open in Email Client</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitSuccess(false);
                    setTitle('');
                    setDescription('');
                    setReproductionSteps('');
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Submit Another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {/* Report Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Report Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800/70 border border-stone-200/60 dark:border-stone-700/50">
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      type === 'bug'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5 text-rose-500" />
                    <span>Bug Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      type === 'feature'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Feature Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('feedback')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      type === 'feedback'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Feedback</span>
                  </button>
                </div>
              </div>

              {/* Title / Summary */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="feedback-title-input" 
                  className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400"
                >
                  Summary / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="feedback-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Brief summary of the bug (e.g., Grocery list does not check off)'
                      : type === 'feature'
                      ? 'Brief summary of the feature (e.g., Apple Reminders sync)'
                      : 'Brief subject of your feedback'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                  disabled={isSubmitting}
                />
              </div>

              {/* Severity (Only for bugs) */}
              {type === 'bug' && (
                <div className="space-y-1.5">
                  <label 
                    htmlFor="feedback-severity-select" 
                    className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400"
                  >
                    Severity
                  </label>
                  <select
                    id="feedback-severity-select"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                    disabled={isSubmitting}
                  >
                    <option value="low">Low - Minor cosmetic or visual annoyance</option>
                    <option value="medium">Medium - Functional glitch with a workaround</option>
                    <option value="high">High - Feature broken or critical data missing</option>
                    <option value="critical">Critical - App crashes or prevents cooking/planning</option>
                  </select>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="feedback-description-input" 
                  className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400"
                >
                  Description & Context <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="feedback-description-input"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Describe what happened, what you expected to happen, and any error messages seen.'
                      : type === 'feature'
                      ? 'Explain the feature you would love to see, how you would use it, and why it would help your kitchen.'
                      : 'Share your suggestions or thoughts.'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none leading-relaxed"
                  disabled={isSubmitting}
                />
              </div>

              {/* Steps to Reproduce (Only for bugs) */}
              {type === 'bug' && (
                <div className="space-y-1.5">
                  <label 
                    htmlFor="feedback-repro-input" 
                    className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400"
                  >
                    Steps to Reproduce (Optional)
                  </label>
                  <textarea
                    id="feedback-repro-input"
                    rows={2}
                    value={reproductionSteps}
                    onChange={(e) => setReproductionSteps(e.target.value)}
                    placeholder="1. Click on...\n2. Then select...\n3. Observe..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* User Email Contact */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="feedback-email-input" 
                  className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between"
                >
                  <span>Your Contact Email</span>
                  <span className="text-[10px] text-stone-400 lowercase font-normal">for follow-up responses</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="feedback-email-input"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Include System Diagnostics Toggle */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                  <Laptop className="w-4 h-4 text-stone-400 shrink-0" />
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-200">Include Browser & Screen Info</p>
                    <p className="text-[11px] text-stone-400">Helps debug screen size and device-specific issues</p>
                  </div>
                </div>
                <input
                  id="feedback-diagnostics-toggle"
                  type="checkbox"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  disabled={isSubmitting}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="feedback-submit-btn"
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send to {TARGET_REPORT_EMAIL}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
