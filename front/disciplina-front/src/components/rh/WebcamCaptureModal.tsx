import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { uploadCandidateAvatar } from '@/api/candidates';

interface WebcamCaptureModalProps {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  /** Called with the new avatarUpdatedAt timestamp after a successful upload. */
  onUploaded: (avatarUpdatedAt: string) => void;
}

export default function WebcamCaptureModal({
  candidateId,
  candidateName,
  onClose,
  onUploaded,
}: WebcamCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.token);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError("Impossible d'accéder à la webcam. Vérifiez les autorisations du navigateur.");
    }
  }, []);

  useEffect(() => {
    // Starting the webcam on mount legitimately requires an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Center-crop to a square.
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCaptured(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stopStream();
      },
      'image/jpeg',
      0.9,
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCaptured(null);
    startStream();
  };

  const save = async () => {
    if (!captured || !token) return;
    setSaving(true);
    setError(null);
    try {
      const updatedAt = await uploadCandidateAvatar(token, candidateId, captured);
      onUploaded(updatedAt);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Photo de {candidateName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
          {previewUrl ? (
            <img src={previewUrl} alt="Aperçu" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-center gap-3">
          {!previewUrl ? (
            <button
              onClick={capture}
              disabled={!!error}
              className="flex items-center gap-2 rounded-lg bg-purple px-5 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              <Camera size={18} /> Prendre la photo
            </button>
          ) : (
            <>
              <button
                onClick={retake}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 font-semibold text-gray-700"
              >
                <RefreshCw size={18} /> Reprendre
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-purple px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Enregistrer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
