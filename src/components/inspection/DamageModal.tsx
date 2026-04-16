import React, { useState } from 'react';
import { VehicleDamage } from '@/types';
import { X } from 'lucide-react';

type ViewAngle = 'front' | 'rear' | 'left' | 'right' | 'top';

interface DamageModalProps {
  onSubmit: (damage: Omit<VehicleDamage, 'coordinates'>) => void;
  onClose: () => void;
  view?: string;
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

const DamageModal: React.FC<DamageModalProps> = ({ onSubmit, onClose, view }) => {
  const isValidView = (v: string | undefined): v is ViewAngle =>
    !!v && v in partsByView;

  const activeParts = isValidView(view) ? partsByView[view] : allParts;
  const [part, setPart] = useState(activeParts[0]);
  const [damageType, setDamageType] = useState<VehicleDamage['damage_type']>('scratch');
  const [severity, setSeverity] = useState<VehicleDamage['severity']>('minor');

  const handleSubmit = () => {
    onSubmit({ part, damage_type: damageType, severity });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5 space-y-4" style={{ boxShadow: 'var(--shadow-modal)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-foreground">Log Damage</h3>
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

        <button onClick={handleSubmit} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          Add Damage
        </button>
      </div>
    </div>
  );
};

export default DamageModal;
