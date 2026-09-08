import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressAndResizeImage } from '../utils/customMealImageUtils';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (dataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);
    setHasCameraAccess(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasCameraAccess(false);
      setCameraError('Live camera not supported by this browser. You can still snap or upload a photo using your device camera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasCameraAccess(true);
    } catch (err: any) {
      console.warn('Camera stream notice:', err);
      setHasCameraAccess(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can allow camera access in your browser or use the file capture button.'
          : 'Unable to access live camera stream. You can still use your device camera via file capture.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode]);

  // Flip camera (between front and rear if available)
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture snapshot from video element
  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // If user camera, mirror horizontally
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Compress to ensure lightweight storage
      const compressed = await compressAndResizeImage(rawDataUrl, 960, 0.75);
      setCapturedPreview(compressed);
      stopCameraStream();
    } catch (err) {
      console.error('Error snapping photo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // File input fallback (works with device camera on mobile and desktop file picker)
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressed = await compressAndResizeImage(file, 960, 0.75);
      setCapturedPreview(compressed);
      stopCameraStream();
    } catch (err) {
      console.error('Error processing camera photo file:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm photo
  const handleConfirmPhoto = () => {
    if (capturedPreview) {
      onPhotoCaptured(capturedPreview);
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif font-bold text-base">Take Meal Photo</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Viewfinder or Preview */}
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] max-h-[460px] overflow-hidden">
            {capturedPreview ? (
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <img
                  src={capturedPreview}
                  alt="Captured Meal Preview"
                  className="max-h-[420px] w-auto max-w-full rounded-2xl object-contain shadow-lg"
                />
                <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[11px] font-medium text-amber-300 border border-amber-500/30">
                  📸 Photo ready • Retained for 30 days
                </div>
              </div>
            ) : hasCameraAccess ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
                {/* Viewfinder crosshairs overlay */}
                <div className="pointer-events-none absolute inset-8 border border-white/20 rounded-2xl flex items-center justify-center">
                  <div className="w-12 h-12 border-t-2 border-l-2 border-white/60 absolute top-0 left-0 rounded-tl-xl" />
                  <div className="w-12 h-12 border-t-2 border-r-2 border-white/60 absolute top-0 right-0 rounded-tr-xl" />
                  <div className="w-12 h-12 border-b-2 border-l-2 border-white/60 absolute bottom-0 left-0 rounded-bl-xl" />
                  <div className="w-12 h-12 border-b-2 border-r-2 border-white/60 absolute bottom-0 right-0 rounded-br-xl" />
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4 max-w-xs text-stone-300">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto opacity-80" />
                <p className="text-xs sm:text-sm text-stone-300">
                  {cameraError || 'Preparing camera...'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 mx-auto shadow-md transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Snap Photo via Device</span>
                </button>
              </div>
            )}

            {/* Hidden device camera input (supports camera on mobile/tablet) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Controls Footer */}
          <div className="p-4 bg-stone-900 border-t border-stone-800 flex items-center justify-between text-white">
            {capturedPreview ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-full border border-stone-700 text-stone-300 hover:bg-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Use This Photo</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-full border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Use native device camera or upload"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Device Camera</span>
                </button>

                {/* Shutter Button */}
                {hasCameraAccess && (
                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    disabled={isProcessing}
                    className="w-14 h-14 rounded-full border-4 border-white/80 bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center p-1 mx-auto shadow-lg"
                    title="Snap Photo"
                  >
                    <div className="w-full h-full rounded-full bg-white transition-transform" />
                  </button>
                )}

                {/* Flip camera if live */}
                {hasCameraAccess ? (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="p-2.5 rounded-full hover:bg-stone-800 text-stone-300 hover:text-white transition-colors"
                    title="Switch Camera (Front/Back)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-10" />
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
