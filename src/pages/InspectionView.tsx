import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { mockJobCards } from '@/data/mock';
import { VehicleDamage, InspectionReport } from '@/types';
import { ArrowLeft, Check, Trash2, Box, Loader2, Sun, Moon, AlertCircle } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import CarDiagram, { TyreOverlay } from '@/components/inspection/CarDiagram';
import { TYRE_CONDITIONS, TYRE_POSITIONS, TYRE_WHEEL_COORDS } from '@/lib/tyreUtils';
import Vehicle3DModel from '@/components/vehicle-3d/Vehicle3DModelWrapper';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import DamageModal from '@/components/inspection/DamageModal';
import { toast } from 'sonner';
import { saveInspectionReport, updateJobCardStatus, fetchJobCardById, fetchJobPhotos, acknowledgeNudgesForJob } from '@/lib/firestore';
import { vehicleViewSVGs, VehicleType } from '@/components/inspection/VehicleSVGs';

const fuelLevels = ['Empty', '1/4', '1/2', '3/4', 'Full'];

const InspectionView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      // Check mock data first (instant for seeded cards)
      const mock = mockJobCards.find(j => j.id === id);
      if (mock) return mock;
      // Fall back to Firestore for newly created jobs
      try { return await fetchJobCardById(id!); } catch { return null; }
    },
  });

  // Load persisted photos from Firestore (survives refreshes & back-navigation)
  const { data: firestorePhotos = {} } = useQuery({
    queryKey: ['job_photos', id],
    queryFn: () => fetchJobPhotos(id!),
    staleTime: Infinity,
    enabled: !!id,
  });
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Traditional inspection state
  const [odometer, setOdometer] = useState<number>(0);
  const [fuelLevel, setFuelLevel] = useState('1/2');
  const [tires, setTires] = useState({
    front_left: '',
    front_right: '',
    rear_left: '',
    rear_right: '',
  });
  const [damages, setDamages] = useState<VehicleDamage[]>([]);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [use3D, setUse3D] = useState(false);
  const [vehicleType, setVehicleType] = useState<'sedan' | 'hatchback' | 'suv' | 'bakkie' | 'truck'>('sedan');
  const [clickView, setClickView] = useState<string>('top');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewPhotos, setViewPhotos] = useState<Partial<Record<string, string>>>({});
  const [tyreErrors, setTyreErrors] = useState<Record<string, boolean>>({});
  // Mechanic-adjusted tyre dot positions — override computed defaults when dragged
  const [tyreAdjustments, setTyreAdjustments] = useState<Record<string, Partial<Record<string, { x: number; y: number }>>>>({});
  const { isDark, toggle: toggleTheme } = useTheme();

  // Sync vehicle type from loaded job so the diagram matches the actual car
  useEffect(() => {
    if (job?.vehicle_type) {
      setVehicleType(job.vehicle_type as typeof vehicleType);
    }
  }, [job]);

  // Mark job as in_progress as soon as mechanic opens the inspection form
  useEffect(() => {
    if (job && job.status === 'booked' && id) {
      updateJobCardStatus(id, 'in_progress')
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          acknowledgeNudgesForJob(id, 'Job started - moved to In Progress').catch(() => {});
        })
        .catch(() => {}); // non-blocking — inspection can still proceed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // Pre-load photos passed from the photo-upload step
  useEffect(() => {
    const incoming = (location.state as Record<string, unknown> | null)
      ?.viewPhotos as Partial<Record<string, string>> | undefined;
    if (incoming && Object.keys(incoming).length > 0) {
      setViewPhotos(incoming);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge: state photos (fresh upload) take priority over Firestore (returning to page)
  const mergedPhotos = { ...firestorePhotos, ...viewPhotos };

  // Build per-view tyre overlays using per-vehicle-type defaults + any drag adjustments
  const tyreOverlaysByView = useMemo(() => {
    const typeMap = TYRE_WHEEL_COORDS[vehicleType] ?? TYRE_WHEEL_COORDS.suv;
    const result: Partial<Record<string, TyreOverlay[]>> = {};
    TYRE_POSITIONS.forEach(({ key, label }) => {
      const value = tires[key];
      if (!value) return;
      const condition = TYRE_CONDITIONS.find(c => c.value === value);
      if (!condition) return;
      const viewCoords = typeMap[key];
      if (!viewCoords) return;
      Object.entries(viewCoords).forEach(([view, coords]) => {
        const adjusted = tyreAdjustments[key]?.[view];
        if (!result[view]) result[view] = [];
        result[view]!.push({
          key,
          label,
          conditionLabel: condition.label,
          color: condition.color,
          x: adjusted?.x ?? coords.x,
          y: adjusted?.y ?? coords.y,
        });
      });
    });
    return result;
  }, [tires, vehicleType, tyreAdjustments]);

  const handleTyrePositionChange = useCallback((key: string, view: string, x: number, y: number) => {
    setTyreAdjustments(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [view]: { x, y } },
    }));
  }, []);

  const handleDiagramClick = useCallback((x: number, y: number, view: string) => {
    setClickCoords({ x, y });
    setClickView(view);
    setShowDamageModal(true);
  }, []);

  const handleAddDamage = (damage: Omit<VehicleDamage, 'coordinates' | 'view'>) => {
    if (!clickCoords) return;
    setDamages(prev => [...prev, { ...damage, coordinates: clickCoords, view: clickView as any }]);
    setShowDamageModal(false);
    setClickCoords(null);
  };

  const handleRemoveDamage = (idx: number) => {
    setDamages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate tyre conditions - all 4 must be selected
    const emptyTyres: Record<string, boolean> = {};
    (['front_left', 'front_right', 'rear_left', 'rear_right'] as const).forEach(pos => {
      if (!tires[pos]) emptyTyres[pos] = true;
    });
    if (Object.keys(emptyTyres).length > 0) {
      setTyreErrors(emptyTyres);
      toast.error('Please select a tyre condition for all four positions.');
      return;
    }
    setTyreErrors({});

    setIsSubmitting(true);
    const signatureData = sigCanvas.current?.toDataURL();
    const report: InspectionReport = {
      id: `IR-${Date.now()}`,
      job_card_id: id!,
      inspection_type: 'pre_service',
      odometer,
      fuel_level: fuelLevel,
      tire_conditions: tires,
      damages,
      signature_url: signatureData,
    };

    try {
      await saveInspectionReport(report);
      await updateJobCardStatus(id!, 'completed');
      acknowledgeNudgesForJob(id!, 'Inspection submitted & job completed').catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Inspection submitted and saved!');
      navigate('/mechanic');
    } catch (error) {
      console.error('Failed to save inspection:', error);
      toast.error('Failed to save inspection — please try again.');
      setIsSubmitting(false);
    }
  };

  if (jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Job card not found.</p>
      </div>
    );
  }

  const jobVehicleType = (vehicleViewSVGs[vehicleType as VehicleType] ? vehicleType : 'sedan') as VehicleType;
  const VehicleImg = vehicleViewSVGs[jobVehicleType].front;

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/mechanic')}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold text-foreground truncate">Pre-Service Inspection</h1>
            <p className="text-xs text-muted-foreground truncate">{job.customer_name} · {job.license_plate}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-1 rounded-full hidden sm:block">{job.id}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-5 mt-5">

        {/* ── Job Context Card ── */}
        <div className="card-elevated overflow-hidden">
          {/* Vehicle image banner */}
          <div className="relative h-44 sm:h-52" style={{ background: 'var(--vehicle-card-bg)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
            {mergedPhotos['front'] ? (
              <img
                src={mergedPhotos['front']}
                alt={job.license_plate}
                className="relative w-full h-full object-contain p-2"
              />
            ) : (
              <VehicleImg
                className="relative w-full h-full p-6"
                style={{ color: 'hsl(var(--primary))' }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent" />
            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <span className="status-badge status-booked">Pre-Service</span>
            </div>
            {/* Job ID */}
            <div className="absolute top-3 right-3">
              <span className="text-[10px] font-mono bg-foreground/50 text-background px-2 py-0.5 rounded-full">{job.id}</span>
            </div>
            {/* License plate */}
            <div className="absolute bottom-3 left-3">
              <span className="text-xs font-mono font-bold text-background bg-foreground/60 backdrop-blur-sm px-2.5 py-1 rounded-lg tracking-widest">
                {job.license_plate}
              </span>
            </div>
          </div>
          {/* Job meta */}
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{job.customer_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">{job.service_details}</p>
            </div>
            {/* 3D toggle */}
            <button
              onClick={() => setUse3D(!use3D)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                backgroundColor: use3D ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: use3D ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              }}
            >
              <Box className="w-3.5 h-3.5" />
              3D
            </button>
          </div>
          {/* Coloured accent border */}
          <div className="h-0.5 w-full bg-primary" />
        </div>

        {/* ── Vehicle Status ── */}
        <section className="card-elevated p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Vehicle Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">Odometer (km)</label>
              <input
                type="number"
                value={odometer || ''}
                onChange={e => setOdometer(Number(e.target.value))}
                placeholder="e.g. 87432"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">Fuel Level</label>
              <select
                value={fuelLevel}
                onChange={e => setFuelLevel(e.target.value)}
                className={inputCls}
              >
                {fuelLevels.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* ── Tyre & Alloy Condition ── */}
        <section className="card-elevated p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tyre &amp; Alloy Condition</h2>
          <p className="text-[10px] text-accent font-medium mb-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> All four tyre conditions are required
          </p>
          {/* Condition legend */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {TYRE_CONDITIONS.map(c => (
              <span key={c.value} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border" style={{ background: c.bg, borderColor: c.border, color: c.color }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TYRE_POSITIONS.map(({ key, label }) => {
              const selected = TYRE_CONDITIONS.find(c => c.value === tires[key]);
              return (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
                  <div className="relative">
                    <select
                      value={tires[key]}
                      onChange={e => {
                        setTires(prev => ({ ...prev, [key]: e.target.value }));
                        if (e.target.value) setTyreErrors(prev => { const n = {...prev}; delete n[key]; return n; });
                      }}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer ${tyreErrors[key] ? 'ring-2 ring-accent/50 border-accent' : ''}`}
                      style={selected ? { color: selected.color, borderColor: selected.border, background: selected.bg } : {}}
                    >
                      <option value="">Select condition…</option>
                      {TYRE_CONDITIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {/* Chevron icon */}
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </div>
                  {tyreErrors[key] && (
                    <p className="text-[10px] text-accent mt-1 flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> Required
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Damage Inspection ── */}
        <section className="card-elevated overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Damage Inspection</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {use3D ? '3D interactive view — click to mark damage' : 'Tap anywhere on the diagram to mark damage'}
                </p>
              </div>
              {damages.length > 0 && (
                <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'hsl(var(--accent)/0.12)', color: 'hsl(var(--accent))' }}>
                  {damages.length} logged
                </span>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-4">
            {use3D ? (
              <ErrorBoundary
                fallback={
                  <div className="bg-muted rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">3D view unavailable. Using 2D diagram instead.</p>
                    <button
                      onClick={() => setUse3D(false)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                    >
                      Switch to 2D
                    </button>
                  </div>
                }
              >
                <Vehicle3DModel
                  damages={damages}
                  onAreaClick={handleDiagramClick}
                  onRemoveDamage={handleRemoveDamage}
                  vehicleType={vehicleType}
                  onVehicleTypeChange={setVehicleType}
                />
              </ErrorBoundary>
            ) : (
              <CarDiagram
                damages={damages}
                onAreaClick={handleDiagramClick}
                onRemoveDamage={handleRemoveDamage}
                vehicleType={vehicleType}
                onVehicleTypeChange={setVehicleType}
                photos={mergedPhotos as any}
                tyreOverlays={tyreOverlaysByView as any}
                onTyrePositionChange={handleTyrePositionChange}
              />
            )}

            {/* Damage list */}
            {damages.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Logged Damages ({damages.length})</p>
                {damages.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-foreground">{d.part}</span>
                      <span className="text-xs text-muted-foreground ml-2 capitalize">{d.damage_type} · {d.severity} · {d.view || 'top'} view</span>
                    </div>
                    <button
                      onClick={() => handleRemoveDamage(i)}
                      className="ml-3 flex-shrink-0 p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Customer Signature ── */}
        <section className="card-elevated overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer Signature</h2>
            <button
              onClick={() => sigCanvas.current?.clear()}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="mx-4 sm:mx-5 mb-1 border border-border rounded-xl overflow-hidden bg-muted/30" style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: 160 },
              }}
              penColor="hsl(220, 25%, 10%)"
              backgroundColor="transparent"
            />
          </div>
          <p className="text-[10px] text-muted-foreground px-4 sm:px-5 pb-4 mt-2">
            By signing, the customer acknowledges the recorded vehicle condition and mileage.
          </p>
        </section>

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-display font-bold text-base hover:opacity-90 active:scale-[.99] transition-all disabled:opacity-60 shadow-sm"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {isSubmitting ? 'Saving…' : 'Submit Inspection'}
        </button>

      </div>

      {/* Damage Modal */}
      {showDamageModal && (
        <DamageModal
          onSubmit={handleAddDamage}
          onClose={() => { setShowDamageModal(false); setClickCoords(null); }}
          view={clickView}
        />
      )}
    </div>
  );
};

export default InspectionView;
