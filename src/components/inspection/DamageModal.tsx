import React, { useRef, useState } from 'react';
import { VehicleDamage } from '@/types';
import { Camera, X } from 'lucide-react';

type ViewAngle = 'front' | 'rear' | 'left' | 'right' | 'top';

interface DamageModalProps {
  onSubmit: (damage: Omit<VehicleDamage, 'coordinates'>) => void;
  onClose: () => void;
  view?: string;
  initialValues?: Pick<VehicleDamage, 'part' | 'damage_type' | 'severity'> & { photo_url?: string };
}

const partsByView: Record<ViewAngle, string[]> = {
  front: [
    'Front Bumper', 'Hood', 'Windshield',
    'Front Left Fender', 'Front Right Fender',
    'Front Left Wheel', 'Front Right Wheel',
    'Left Mirror', 'Right Mirror',
    'Front Left Door', 'Front Right Door',
    'Roof',
  ],
  rear: [
    'Rear Bumper', 'Trunk', 'Rear Window',
    'Rear Left Quarter', 'Rear Right Quarter',
    'Rear Left Wheel', 'Rear Right Wheel',
    'Left Mirror', 'Right Mirror',
    'Rear Left Door', 'Rear Right Door',
    'Roof',
  ],
  left: [
    'Front Left Door', 'Rear Left Door',
    'Front Left Fender', 'Rear Left Quarter',
    'Left Mirror',
    'Front Left Wheel', 'Rear Left Wheel',
    'Windshield', 'Rear Window', 'Roof',
    'Front Bumper', 'Rear Bumper',
  ],
  right: [
    'Front Right Door', 'Rear Right Door',
    'Front Right Fender', 'Rear Right Quarter',
    'Right Mirror',
    'Front Right Wheel', 'Rear Right Wheel',
    'Windshield', 'Rear Window', 'Roof',
    'Front Bumper', 'Rear Bumper',
  ],
  top: [
    'Roof', 'Hood', 'Trunk',
    'Front Left Door', 'Front Right Door',
    'Rear Left Door', 'Rear Right Door',
    'Front Bumper', 'Rear Bumper',
    'Front Left Fender', 'Front Right Fender',
    'Rear Left Quarter', 'Rear Right Quarter',
  ],
};

const viewLabel: Record<ViewAngle, string> = {
  front: 'Front View', rear: 'Rear View',
  left: 'Left Side', right: 'Right Side', top: 'Top View',
};

const allParts = [
  'Front Bumper', 'Rear Bumper', 'Hood', 'Roof', 'Trunk',
  'Front Left Fender', 'Front Right Fender', 'Rear Left Quarter', 'Rear Right Quarter',
  'Front Left Door', 'Front Right Door', 'Rear Left Door', 'Rear Right Door',
  'Left Mirror', 'Right Mirror', 'Windshield', 'Rear Window',
  'Front Left Wheel', 'Front Right Wheel', 'Rear Left Wheel', 'Rear Right Wheel',
];

const DamageModal: React.FC<DamageModalProps> = ({ onSubmit, onClose, view, initialValues }) => {
  const isEdit = !!initialValues;
  const isValidView = (v: string | undefined): v is ViewAngle =>
    !!v && v in partsByView;

  const activeParts = isValidView(view) ? partsByView[view] : allParts;
  const [part, setPart] = useState(initialValues?.part ?? activeParts[0]);
  const [damageType, setDamageType] = useState<VehicleDamage['damage_type']>(initialValues?.damage_type ?? 'scratch');
  const [severity, setSeverity] = useState<VehicleDamage['severity']>(initialValues?.severity ?? 'minor');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialValues?.photo_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      // Resize to max 800 px and compress to JPEG 0.5 before storing.
      // A raw camera photo can be 3–5 MB; this brings it under ~80 KB,
      // keeping the Firestore document well within the 1 MB limit.
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleSubmit = () => {
    onSubmit({ part, damage_type: damageType, severity, photo_url: photoUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5 space-y-4" style={{ boxShadow: 'var(--shadow-modal)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-foreground">{isEdit ? 'Edit Damage' : 'Log Damage'}</h3>
            {isValidView(view) && (
              <span className="text-[11px] text-primary font-medium">{viewLabel[view]} — showing relevant parts</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        {/* Part */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vehicle Part</label>
          <select value={part} onChange={e => setPart(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            {activeParts.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Damage Type */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Damage Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['scratch', 'dent', 'crack'] as const).map(t => (
              <button
                key={t}
                onClick={() => setDamageType(t)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  damageType === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Severity</label>
          <div className="grid grid-cols-2 gap-2">
            {(['minor', 'major'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  severity === s
                    ? (s === 'major' ? 'bg-accent text-accent-foreground' : 'bg-warning text-warning-foreground')
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Close-up Photo */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Close-up Photo <span className="text-muted-foreground/50">(optional)</span></label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
          {photoUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 120 }}>
              <img src={photoUrl} alt="Damage close-up" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhotoUrl(undefined)}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                aria-label="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                <span className="text-[10px] text-white/80">Tap × to retake</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span className="text-sm">Capture close-up photo</span>
            </button>
          )}
        </div>

        <button onClick={handleSubmit} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          {isEdit ? 'Save Changes' : 'Add Damage'}
        </button>
      </div>
    </div>
  );
};

export default DamageModal;
