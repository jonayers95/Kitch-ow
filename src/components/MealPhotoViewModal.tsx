import React from 'react';
import { X, Clock, Calendar, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MealSlot } from '../types';
import { getDaysRemaining, IMAGE_RETENTION_DAYS } from '../utils/customMealImageUtils';

interface MealPhotoViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: MealSlot | null;
}

export const MealPhotoViewModal: React.FC<MealPhotoViewModalProps> = ({
  isOpen,
  onClose,
  slot,
}) => {
  if (!isOpen || !slot?.imageUrl) return null;

  const daysRemaining = getDaysRemaining(slot);
  const capturedDateStr = slot.imageCapturedAt
    ? new Date(slot.imageCapturedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl text-white flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h3 className="font-serif font-bold text-base text-white truncate">
                {slot.customTitle || 'Custom Meal Photo'}
              </h3>
              {capturedDateStr && (
                <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>Captured on {capturedDateStr}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Photo Display */}
          <div className="p-3 bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
            <img
              src={slot.imageUrl}
              alt={slot.customTitle || 'Custom Meal'}
              className="max-h-[55vh] w-auto max-w-full rounded-2xl object-contain shadow-lg"
            />
          </div>

          {/* Retention & Details Footer */}
          <div className="p-4 bg-stone-900 border-t border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>{daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expiring today'}</span>
              </span>
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>{IMAGE_RETENTION_DAYS}-day max retention policy</span>
              </span>
            </div>

            {slot.notes && (
              <p className="text-xs text-stone-300 italic pt-1 border-t border-stone-800">
                "{slot.notes}"
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
