import React, { useRef, useState as S } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { mockJobCards } from '@/data/mock';
import { fetchJobCardById, saveJobPhotos, acknowledgeNudgesForJob } from '@/lib/firestore';
import { ViewAngle } from '@/components/inspection/VehicleSVGs';
import Navbar from '@/components/layout/Navbar';
import { ArrowLeft, Loader2, Camera, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ── Per-angle upload row ───────────────────────────────────────────────────────

interface AngleRowProps {
  label: string;
  image?: string;
  onUpload: (src: string) => void;
  onRemove: () => void;
}

const AngleRow: React.FC<AngleRowProps> = ({ label, image, onUpload, onRemove }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camActive, setCamActive] = S(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onload = ev => { onUpload(ev.target!.result as string); toast.success(`${label} photo uploaded`); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setCamActive(true); }
    } catch { toast.error('Could not access camera — check permissions.'); }
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    onUpload(canvasRef.current.toDataURL('image/jpeg', 0.92));
    stopCamera();
    toast.success(`${label} photo captured`);
  };

  const stopCamera = () => {
    (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
    setCamActive(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {camActive && (
        <div className="relative">
          <video ref={videoRef} autoPlay playsInline className="w-full max-h-56 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
            <button onClick={capture} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg">
              <Camera className="w-3.5 h-3.5" /> Capture
            </button>
            <button onClick={stopCamera} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 text-white text-xs font-semibold">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}
      {!camActive && (
        <div className="flex items-center gap-3 p-3">
          <div className="relative w-20 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted border border-border">
            {image ? (
              <>
                <img src={image} alt={label} className="w-full h-full object-cover" />
                <button onClick={onRemove} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-muted-foreground opacity-40" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className={`text-xs mt-0.5 ${image ? 'text-green-600' : 'text-muted-foreground'}`}>
              {image ? 'Photo ready' : 'Not uploaded'}
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted text-xs font-medium text-foreground hover:bg-secondary transition-colors">
              <Upload className="w-3 h-3" /> Upload
            </button>
            <button onClick={startCamera} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-muted text-xs font-medium text-foreground hover:bg-secondary transition-colors">
              <Camera className="w-3 h-3" /> Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Uploader ──────────────────────────────────────────────────────────────────

const ANGLES: { key: ViewAngle; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'rear',  label: 'Rear'  },
  { key: 'left',  label: 'Left Side' },
  { key: 'right', label: 'Right Side' },
];

interface UploaderProps {
  onPhotosReady: (p: Partial<Record<ViewAngle, string>>) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

const VehiclePhotoUploader: React.FC<UploaderProps> = ({ onPhotosReady, onCancel, isSaving = false }) => {
  const [photos, setPhotos] = S<Partial<Record<ViewAngle, string>>>({});
  const count = Object.keys(photos).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-display font-bold text-foreground">Capture Vehicle Photos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload or capture a photo from each angle. They appear as the background in the damage inspection diagram.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${count === ANGLES.length ? 'text-green-600' : 'text-muted-foreground'}`} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">{count} of {ANGLES.length} photos ready</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(count / ANGLES.length) * 100}%` }} />
          </div>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{count}/{ANGLES.length}</span>
      </div>

      {/* Angle rows */}
      <div className="space-y-2.5">
        {ANGLES.map(({ key, label }) => (
          <AngleRow
            key={key}
            label={label}
            image={photos[key]}
            onUpload={src => setPhotos(p => ({ ...p, [key]: src }))}
            onRemove={() => setPhotos(p => { const n = { ...p }; delete n[key]; return n; })}
          />
        ))}
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-900 mb-1">Tips for clear photos:</p>
          <ul className="text-xs text-amber-800 space-y-0.5 list-disc ml-3">
            <li>Use good, even lighting — avoid harsh shadows</li>
            <li>Keep the full vehicle in frame</li>
            <li>Same distance for each angle</li>
            <li>Clean the lens before shooting</li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onPhotosReady(photos)}
          disabled={count === 0 || isSaving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : count === ANGLES.length ? 'Start Inspection →' : count > 0 ? `Continue with ${count} photo${count !== 1 ? 's' : ''} →` : 'Add photos to continue'}
        </button>
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

const PhotoUploadPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = S(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const mock = mockJobCards.find(j => j.id === id);
      if (mock) return mock;
      try { return await fetchJobCardById(id!); } catch { return null; }
    },
  });

  const handlePhotosReady = async (photos: Partial<Record<ViewAngle, string>>) => {
    setIsSaving(true);
    try {
      await saveJobPhotos(id!, photos);
      acknowledgeNudgesForJob(id!, 'Photos uploaded').catch(() => {});
      // Invalidate all photo caches so dashboards and detail views refresh immediately
      queryClient.invalidateQueries({ queryKey: ['all_job_photos'] });
      queryClient.invalidateQueries({ queryKey: ['job_photos', id] });
    } catch {
      // Non-fatal — photos still passed via navigation state for this session
      toast.warning('Could not sync photos to server — they will be available for this session only.');
    }
    setIsSaving(false);
    navigate(`/mechanic/inspect/${id}`, { state: { viewPhotos: photos } });
  };

  const handleCancel = () => navigate('/mechanic');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <Navbar userName={user?.name} role="Mechanic" onLogout={logout} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleCancel} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold text-foreground truncate">Capture Vehicle Photos</h1>
            {job && <p className="text-xs text-muted-foreground">{job.customer_name} · {job.license_plate}</p>}
          </div>
          {job && <span className="text-xs font-mono text-muted-foreground hidden sm:block">{job.id}</span>}
        </div>
        <div className="card-elevated p-5">
          <VehiclePhotoUploader onPhotosReady={handlePhotosReady} onCancel={handleCancel} isSaving={isSaving} />
        </div>
      </div>
    </div>
  );
};

export default PhotoUploadPage;
