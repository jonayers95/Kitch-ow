import { FeedbackReport } from '../types';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const TARGET_REPORT_EMAIL = 'AyersAIDev@gmail.com';

/**
 * Formats a clean, readable email subject and body for bug/feature reports.
 * Does not use any AI tokens or LLMs - strictly deterministic formatting.
 */
export function formatReportEmailBody(report: FeedbackReport): {
  subject: string;
  body: string;
  mailtoUrl: string;
} {
  let subjectPrefix = '[FEEDBACK]';
  if (report.type === 'bug') {
    const sev = (report.severity || 'normal').toUpperCase();
    subjectPrefix = `[BUG - ${sev}]`;
  } else if (report.type === 'feature') {
    subjectPrefix = '[FEATURE REQUEST]';
  }

  const subject = `${subjectPrefix} ${report.title.trim()}`;

  const lines: string[] = [
    `=== MEAL PLANNER ${report.type === 'bug' ? 'BUG REPORT' : report.type === 'feature' ? 'FEATURE REQUEST' : 'FEEDBACK'} ===`,
    ``,
    `Type: ${report.type === 'bug' ? 'BUG REPORT' : report.type === 'feature' ? 'FEATURE REQUEST' : 'GENERAL FEEDBACK'}`,
    `Title: ${report.title.trim()}`,
  ];

  if (report.type === 'bug' && report.severity) {
    lines.push(`Severity: ${report.severity}`);
  }

  lines.push(
    `Reporter Email: ${report.userEmail || 'Anonymous / Unprovided'}`,
    `Reporter UID: ${report.userId || 'Not signed in'}`,
    `Household: ${report.householdName ? `${report.householdName} (${report.householdId || 'N/A'})` : (report.householdId || 'None')}`,
    `Submitted At: ${report.timestamp || new Date().toISOString()}`,
    ``,
    `--------------------------------------------------`,
    `Description:`,
    report.description.trim(),
    `--------------------------------------------------`
  );

  if (report.reproductionSteps && report.reproductionSteps.trim()) {
    lines.push(
      ``,
      `Steps to Reproduce:`,
      report.reproductionSteps.trim(),
      `--------------------------------------------------`
    );
  }

  lines.push(
    ``,
    `--- System & Environment Diagnostics ---`,
    `App URL: ${report.appUrl || (typeof window !== 'undefined' ? window.location.href : 'Unknown')}`,
    `User Agent: ${report.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown')}`,
    `Screen Size: ${report.screenSize || (typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown')}`,
    ``,
    `Note: Zero AI credits/tokens consumed. Automated dispatch to ${TARGET_REPORT_EMAIL}.`
  );

  const body = lines.join('\n');
  const mailtoUrl = `mailto:${TARGET_REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { subject, body, mailtoUrl };
}

/**
 * Generates an active mailto link addressed to AyersAIDev@gmail.com
 */
export function generateMailtoLink(report: FeedbackReport): string {
  return formatReportEmailBody(report).mailtoUrl;
}

/**
 * Submits the feedback or bug report without consuming any AI tokens.
 * Sends data to /api/feedback which relays directly to AyersAIDev@gmail.com,
 * and saves a copy to Firestore feedback_reports collection when available.
 */
export async function submitFeedbackReport(report: FeedbackReport): Promise<{
  success: boolean;
  message: string;
  reportId?: string;
  mailtoUrl?: string;
}> {
  if (!report.title || !report.title.trim()) {
    throw new Error('Please provide a title or summary for your report.');
  }

  if (!report.description || !report.description.trim()) {
    throw new Error('Please provide a description or details for your report.');
  }

  // Enrich report with client diagnostics if available
  const enrichedReport: FeedbackReport = {
    ...report,
    title: report.title.trim(),
    description: report.description.trim(),
    timestamp: report.timestamp || new Date().toISOString(),
    appUrl: report.appUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    userAgent: report.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    screenSize: report.screenSize || (typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : ''),
  };

  const { mailtoUrl } = formatReportEmailBody(enrichedReport);

  // 1. Non-blocking Firestore save for persistence/audit without stalling user submission
  let firestoreDocId: string | undefined;
  if (db) {
    try {
      const colRef = collection(db, 'feedback_reports');
      // Execute in background without awaiting to prevent offline gRPC hanging
      addDoc(colRef, {
        ...enrichedReport,
        targetEmail: TARGET_REPORT_EMAIL,
        status: 'new',
        createdAt: serverTimestamp(),
      }).catch((err: any) => {
        console.warn('[Feedback] Firestore persistence notice:', err?.message || err);
      });
    } catch (err: any) {
      console.warn('[Feedback] Could not initiate Firestore save:', err?.message || err);
    }
  }

  // 2. Submit to backend /api/feedback which forwards to AyersAIDev@gmail.com
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...enrichedReport,
        firestoreDocId,
        targetEmail: TARGET_REPORT_EMAIL,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || `Report sent to ${TARGET_REPORT_EMAIL} successfully`,
      reportId: data.reportId || firestoreDocId,
      mailtoUrl,
    };
  } catch (netErr: any) {
    console.warn('[Feedback] Server API submission notice, offering direct mail link:', netErr?.message || netErr);
    // If backend is unreachable or offline, still succeed with client mailto backup
    return {
      success: true,
      message: `Report prepared for ${TARGET_REPORT_EMAIL}`,
      reportId: firestoreDocId,
      mailtoUrl,
    };
  }
}
