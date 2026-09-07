import React from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { HouseholdInvite } from '../types';

interface HouseholdInvitesBannerProps {
  invites: HouseholdInvite[];
  onAccept: (invite: HouseholdInvite) => void;
  onReject: (invite: HouseholdInvite) => void;
  isProcessingId?: string | null;
}

export const HouseholdInvitesBanner: React.FC<HouseholdInvitesBannerProps> = ({
  invites,
  onAccept,
  onReject,
  isProcessingId
}) => {
  if (!invites || invites.length === 0) return null;

  return (
    <section 
      id="household-pending-invites-banner"
      aria-label="Pending Kitchen Invitations" 
      className="mb-6 space-y-3"
    >
      {invites.map((invite) => {
        const isBusy = isProcessingId === invite.id;
        const inviter = invite.invitedByName || invite.invitedByEmail || 'A household member';

        return (
          <div
            key={invite.id}
            id={`invite-card-${invite.id}`}
            className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-stone-900 dark:text-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs backdrop-blur-xs"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold truncate text-stone-900 dark:text-stone-100">
                    Invitation to join <span className="font-bold text-amber-700 dark:text-amber-400">"{invite.householdName}"</span>
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {invite.role}
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Invited by <span className="font-medium text-stone-800 dark:text-stone-200">{inviter}</span>
                  {invite.invitedByEmail && invite.invitedByName && (
                    <span className="text-stone-400 dark:text-stone-500 ml-1">({invite.invitedByEmail})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
              <button
                id={`reject-invite-btn-${invite.id}`}
                type="button"
                onClick={() => onReject(invite)}
                disabled={isBusy}
                className="px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5 text-stone-500" />
                <span>Decline</span>
              </button>

              <button
                id={`accept-invite-btn-${invite.id}`}
                type="button"
                onClick={() => onAccept(invite)}
                disabled={isBusy}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Join Kitchen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
};
