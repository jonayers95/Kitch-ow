import React, { useState, useRef } from 'react';
import { Camera, Trash2, RefreshCw, Clock, Image as ImageIcon, Upload } from 'lucide-react';
import { CameraCaptureModal } from './CameraCaptureModal';
import { compressAndResizeImage, IMAGE_RETENTION_DAYS } from '../utils/customMealImageUtils';

interface CustomMealCameraInputProps {
  photoDataUrl: string | null;
  onPhotoChange: (photoDataUrl: string | null) => void;
}

export const CustomMealCameraInput: React.FC<CustomMealCameraInputProps> = ({
  photoDataUrl,
  onPhotoChange,
}) => {
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleNativeFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const compressed = await compressAndResizeImage(file, 960, 0.75);
      onPhotoChange(compressed);
    } catch (err) {
      console.error('Error attaching photo:', err);
    } finally {
      setIsUploading(false);
      // Reset input value so same file could be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-amber-500" />
          <span>Dish Photo (Optional)</span>
        </label>
        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Stored for {IMAGE_RETENTION_DAYS} days</span>
        </span>
      </div>

      {photoDataUrl ? (
        <div className="relative rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-850 p-2.5 flex items-center gap-3">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
            <img
              src={photoDataUrl}
              alt="Custom Meal Preview"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Camera Photo Attached</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              Auto-purged after {IMAGE_RETENTION_DAYS} days to preserve storage.
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={() => onPhotoChange(null)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-3 bg-stone-50/50 dark:bg-stone-850/40 text-center space-y-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Photo with Camera</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750 flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-stone-400" />
              <span>{isUploading ? 'Compressing...' : 'Device Camera / File'}</span>
            </button>
          </div>

          <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-tight">
            Optionally snap a photo of your dinner, cookbook, or leftovers. Photos automatically expire after {IMAGE_RETENTION_DAYS} days.
          </p>
        </div>
      )}

      {/* Hidden file input with environment camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeFileInput}
      />

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={(dataUrl) => onPhotoChange(dataUrl)}
      />
    </div>
  );
};
