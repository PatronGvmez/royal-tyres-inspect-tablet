import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { mockJobCards } from '@/data/mock';
import { VehicleDamage, InspectionReport } from '@/types';
import { ArrowLeft, Check, Trash2, Box, Loader2, Sun, Moon, AlertCircle, AlertTriangle, Clock, Gauge, Pencil } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/AuthContext';
import CarDiagram, { TyreOverlay } from '@/components/inspection/CarDiagram';
import { TYRE_CONDITIONS, TYRE_POSITIONS, TYRE_WHEEL_COORDS } from '@/lib/tyreUtils';
import Vehicle3DModel from '@/components/vehicle-3d/Vehicle3DModelWrapper';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import DamageModal from '@/components/inspection/DamageModal';
import { toast } from 'sonner';
import { saveInspectionReport, updateJobCardStatus, fetchJobCardById, fetchJobPhotos, acknowledgeNudgesForJob, saveInspectionDraft, fetchInspectionDraft, deleteInspectionDraft, InspectionDraft } from '@/lib/firestore';
import { vehicleViewSVGs, VehicleType } from '@/components/inspection/VehicleSVGs';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const InspectionView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuth();
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
    staleTime: 30_000, // 30 s — short enough to pick up freshly uploaded photos
    enabled: !!id,
  });
  const mechanicSigCanvas = useRef<SignatureCanvas>(null);
  const customerSigCanvas = useRef<SignatureCanvas>(null);

  // Signature timestamps — set onEnd so we capture exactly when they signed
  const [mechanicSignedAt, setMechanicSignedAt] = useState<string | null>(null);
  const [customerSignedAt, setCustomerSignedAt] = useState<string | null>(null);
  // Show/hide the timestamp badge per signer
  const [showMechanicTime, setShowMechanicTime] = useState(false);
  const [showCustomerTime, setShowCustomerTime] = useState(false);
  // Customer name for the customer signature block
  const [customerName, setCustomerName] = useState('');

  // Traditional inspection state
  const [tires, setTires] = useState({
    front_left: '',
    front_right: '',
    rear_left: '',
    rear_right: '',
  });
  const [damages, setDamages] = useState<VehicleDamage[]>([]);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [editingDamageIdx, setEditingDamageIdx] = useState<number | null>(null);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [use3D, setUse3D] = useState(false);
  const [vehicleType, setVehicleType] = useState<'sedan' | 'hatchback' | 'suv' | 'bakkie' | 'truck'>('sedan');
  const [clickView, setClickView] = useState<string>('front');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewPhotos, setViewPhotos] = useState<Partial<Record<string, string>>>({});
  const [tyreErrors, setTyreErrors] = useState<Record<string, boolean>>({});
  // Mechanic-adjusted tyre dot positions — override computed defaults when dragged
  const [tyreAdjustments, setTyreAdjustments] = useState<Record<string, Partial<Record<string, { x: number; y: number }>>>>({});
  const { isDark, toggle: toggleTheme } = useTheme();
  // Timer ref for debounced auto-save — avoids excessive Firestore writes on rapid changes
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether draft has been restored — prevents double-apply on StrictMode double-invoke
  const draftRestoredRef = useRef(false);
  // Disable auto-save for the session if the Firestore write stream gets exhausted.
  // Recovery requires a page reload; the Submit button still works after reload.
  const writeStreamHealthyRef = useRef(true);
  // Set during draft restore so the next auto-save effect run is skipped (data already in Firestore).
  const suppressAutoSaveRef = useRef(false);
  // Shown to the mechanic when write stream gets exhausted so they know to submit manually.
  const [autoSaveDisabled, setAutoSaveDisabled] = useState(false);

  // Load persisted draft for this job (survives navigation / page refresh)
  const { data: existingDraft } = useQuery<InspectionDraft | null>({
    queryKey: ['inspection_draft', id],
    queryFn: () => fetchInspectionDraft(id!),
    enabled: !!id,
    staleTime: Infinity,
  });

  // Sync vehicle type from loaded job so the diagram matches the actual car
  useEffect(() => {
    if (job?.vehicle_type) {
      setVehicleType(job.vehicle_type as typeof vehicleType);
    }
  }, [job]);

  // Pre-fill customer name from the job card — mechanic can still edit it.
  // Only seeds if the field is still empty (draft restore or manual entry takes priority).
  useEffect(() => {
    if (job?.customer_name && customerName === '') {
      setCustomerName(job.customer_name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.customer_name]);

  // Restore draft state once — only when draft loads AND tires are still empty (fresh open)
  useEffect(() => {
    if (!existingDraft || draftRestoredRef.current) return;
    const anyTireFilled = Object.values(tires).some(v => v !== '');
    if (anyTireFilled) return; // mechanic already started entering data — don't overwrite
    draftRestoredRef.current = true;
    suppressAutoSaveRef.current = true; // skip the auto-save that fires on these state updates — data is already in Firestore
    if (existingDraft.tires) setTires(existingDraft.tires);
    if (existingDraft.damages?.length) setDamages(existingDraft.damages);
    if (existingDraft.tyreAdjustments && Object.keys(existingDraft.tyreAdjustments).length) {
      setTyreAdjustments(existingDraft.tyreAdjustments);
    }
    if (existingDraft.customerName) setCustomerName(existingDraft.customerName);
    toast.info('Previous work restored — pick up where you left off.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft]);

  // Debounced auto-save — 8 s after last change to prevent flooding the Firestore write queue
  useEffect(() => {
    if (!id) return;
    // Skip if the write stream is known-exhausted — avoids piling up more writes into a broken queue
    if (!writeStreamHealthyRef.current) return;
    // Skip the first render triggered by draft restore — that data is already persisted in Firestore
    if (suppressAutoSaveRef.current) { suppressAutoSaveRef.current = false; return; }
    // Don't auto-save if nothing has been entered yet
    const hasData = Object.values(tires).some(v => v !== '') || damages.length > 0 || customerName.trim() !== '';
    if (!hasData) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      // Reconstruct damages as plain objects to prevent Firestore from rejecting undefined/class values
      const draftDamages = damages.map(d => {
        const item: VehicleDamage = {
          part: d.part,
          damage_type: d.damage_type,
          severity: d.severity,
          coordinates: { x: d.coordinates?.x ?? 0, y: d.coordinates?.y ?? 0 },
        };
        if (d.view) item.view = d.view;
        if (typeof d.photo_url === 'string' && d.photo_url.length > 0) item.photo_url = d.photo_url;
        return item;
      });
      saveInspectionDraft(id, {
        job_card_id: id,
        tires,
        damages: draftDamages,
        tyreAdjustments,
        customerName,
      }).catch((err: unknown) => {
        const code = (err as { code?: string })?.code;
        if (code === 'resource-exhausted') {
          // Write stream is exhausted — disable auto-save for this session.
          // User must reload the page to recover; final Submit will work after reload.
          writeStreamHealthyRef.current = false;
          setAutoSaveDisabled(true);
        }
      });
    }, 8000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tires, damages, tyreAdjustments, customerName, id]);

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

  const handleDamageMove = useCallback((idx: number, x: number, y: number) => {
    setDamages(prev => prev.map((d, i) => i === idx ? { ...d, coordinates: { x, y } } : d));
  }, []);

  const handleEditDamage = useCallback((idx: number) => {
    setEditingDamageIdx(idx);
  }, []);

  const handleUpdateDamage = (update: Omit<VehicleDamage, 'coordinates' | 'view'>) => {
    if (editingDamageIdx === null) return;
    setDamages(prev => prev.map((d, i) =>
      i === editingDamageIdx ? { ...d, ...update } : d
    ));
    setEditingDamageIdx(null);
  };

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

  // Helper: Recursively remove undefined values for Firestore compatibility
  const cleanUndefined = (obj: Record<string, any>): Record<string, any> => {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [
          k,
          Array.isArray(v)
            ? v.map(item => (item && typeof item === 'object' ? cleanUndefined(item) : item))
            : v && typeof v === 'object' && !Array.isArray(v)
              ? cleanUndefined(v)
              : v,
        ])
    );
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

    // Validate customer name is present when signature has been provided
    if (customerSigCanvas.current && !customerSigCanvas.current.isEmpty() && !customerName.trim()) {
      toast.error('Please enter the customer name before signing.');
      setIsSubmitting(false);
      return;
    }

    // Validate mechanic name is present
    if (!user?.name) {
      toast.error('Your profile is missing a name. Please update your profile first.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    // Composite onto a white canvas before JPEG encoding.
    // JPEG does not support transparency — without this the transparent SignatureCanvas
    // background becomes solid black, making the strokes invisible on the report.
    const toWhiteJpeg = (srcCanvas: HTMLCanvasElement): string => {
      const c = document.createElement('canvas');
      c.width = srcCanvas.width;
      c.height = srcCanvas.height;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(srcCanvas, 0, 0);
      return c.toDataURL('image/jpeg', 0.7);
    };
    const mechanicSig = mechanicSigCanvas.current?.isEmpty()
      ? undefined
      : toWhiteJpeg(mechanicSigCanvas.current.getCanvas());
    const customerSig = customerSigCanvas.current?.isEmpty()
      ? undefined
      : toWhiteJpeg(customerSigCanvas.current.getCanvas());

    // Explicitly reconstruct each damage as a plain primitive object.
    // This prevents Firestore rejecting class instances (e.g. Timestamps, StorageRef)
    // or undefined values that may have been stored in the damages array.
    const safeDamages: VehicleDamage[] = damages.map(d => {
      const item: VehicleDamage = {
        part: d.part,
        damage_type: d.damage_type,
        severity: d.severity,
        coordinates: {
          x: typeof d.coordinates?.x === 'number' ? d.coordinates.x : 0,
          y: typeof d.coordinates?.y === 'number' ? d.coordinates.y : 0,
        },
      };
      if (d.view) item.view = d.view;
      // Only include photo_url when it is a non-empty string (skip undefined / null / File objects)
      if (typeof d.photo_url === 'string' && d.photo_url.length > 0) item.photo_url = d.photo_url;
      return item;
    });

    const report: InspectionReport = {
      id: `IR-${Date.now()}`,
      job_card_id: id!,
      inspection_type: 'pre_service',
      tire_conditions: tires,
      damages: safeDamages,
      tyreAdjustments: Object.keys(tyreAdjustments).length > 0 ? tyreAdjustments : undefined,
      mechanic_name: user.name,
      mechanic_signature_url: mechanicSig,
      mechanic_signed_at: mechanicSig ? (mechanicSignedAt ?? now) : undefined,
      customer_name: customerName || undefined,
      customer_signature_url: customerSig,
      customer_signed_at: customerSig ? (customerSignedAt ?? now) : undefined,
    };

    try {
      // Strip undefined values before saving to Firestore
      const cleanReport = cleanUndefined(report) as InspectionReport;
      await saveInspectionReport(cleanReport);
      await updateJobCardStatus(id!, 'completed');
      // Clean up the draft — job is now fully submitted
      deleteInspectionDraft(id!).catch(() => {});
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
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

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 space-y-5 mt-5">

        {/* ── Auto-save disabled banner ── */}
        {autoSaveDisabled && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-600/40 dark:bg-amber-950/30">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-snug">
              Auto-save paused — Firestore write limit reached. Your work is safe in this session. Complete the form and tap <strong>Submit Inspection</strong> when done.
            </p>
          </div>
        )}

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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{job.customer_name}</p>
              {/* Service badge */}
              {job.service_details && (
                <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 line-clamp-1">
                  {job.service_details}
                </span>
              )}
              {/* Odometer at intake */}
              {job.odometer != null && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                  <Gauge className="w-3 h-3" />
                  {job.odometer.toLocaleString()} km at intake
                </span>
              )}
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
          {/* Intake photos strip */}
          {(job.license_plate_photo || job.disk_photo) && (
            <div className="px-4 pb-3 flex gap-2">
              {job.license_plate_photo && (
                <a href={job.license_plate_photo} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  <img src={job.license_plate_photo} alt="License plate" className="h-14 w-20 object-cover rounded-lg border border-border" />
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-center">Plate</p>
                </a>
              )}
              {job.disk_photo && (
                <a href={job.disk_photo} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  <img src={job.disk_photo} alt="License disk" className="h-14 w-20 object-cover rounded-lg border border-border" />
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-center">License Disk</p>
                </a>
              )}
            </div>
          )}
          {/* Coloured accent border */}
          <div className="h-0.5 w-full bg-primary" />
        </div>



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
                onDamageMove={handleDamageMove}
                onEditDamage={handleEditDamage}
                vehicleType={vehicleType}
                onVehicleTypeChange={setVehicleType}
                photos={mergedPhotos as any}
                tyreOverlays={tyreOverlaysByView as any}
                onTyrePositionChange={handleTyrePositionChange}
              />
            )}

            {/* Inspection summary — tyre conditions + damages */}
            {(Object.values(tires).some(v => v !== '') || damages.length > 0) && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inspection Summary</p>

                {/* Tyre conditions */}
                {Object.values(tires).some(v => v !== '') && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/60 border-b border-border">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wheel Conditions</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-y divide-border">
                      {TYRE_POSITIONS.map(({ key, label }) => {
                        const val = tires[key as keyof typeof tires];
                        const condition = TYRE_CONDITIONS.find(c => c.value === val);
                        return (
                          <div key={key} className="flex items-center justify-between px-3 py-2.5 bg-card">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            {condition ? (
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: condition.bg, color: condition.color, border: `1px solid ${condition.border}` }}
                              >
                                {condition.label}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Not set</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Damage entries */}
                {damages.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/60 border-b border-border flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Logged Damages</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        {damages.length} item{damages.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {damages.map((d, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-card">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-semibold text-foreground">{d.part}</span>
                            <span className="text-xs text-muted-foreground ml-2 capitalize">
                              {d.damage_type} · {d.severity} · {d.view || 'top'} view
                            </span>
                          </div>
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <button
                              onClick={() => handleEditDamage(i)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit damage"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveDamage(i)}
                              className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              title="Remove damage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Inspector Signature ── */}
        <section className="card-elevated overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inspector Signature</h2>
                <p className="text-sm font-medium text-foreground mt-0.5">{user?.name ?? 'Mechanic'}</p>
              </div>
              <div className="flex items-center gap-2">
                {mechanicSignedAt && (
                  <button
                    type="button"
                    onClick={() => setShowMechanicTime(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      showMechanicTime ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {showMechanicTime ? formatDateTime(mechanicSignedAt) : 'Time'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { mechanicSigCanvas.current?.clear(); setMechanicSignedAt(null); setShowMechanicTime(false); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="mx-4 sm:mx-5 mb-1 border border-border rounded-xl overflow-hidden bg-muted/30" style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={mechanicSigCanvas}
              canvasProps={{ className: 'w-full', style: { width: '100%', height: 160 } }}
              penColor="hsl(220, 25%, 10%)"
              backgroundColor="transparent"
              onEnd={() => setMechanicSignedAt(prev => prev ?? new Date().toISOString())}
            />
          </div>
          <p className="text-[10px] text-muted-foreground px-4 sm:px-5 pb-4 mt-2">
            By signing, the inspector confirms the accuracy of this inspection report.
          </p>
        </section>

        {/* ── Customer Signature ── */}
        <section className="card-elevated overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer Signature</h2>
              <div className="flex items-center gap-2">
                {customerSignedAt && (
                  <button
                    type="button"
                    onClick={() => setShowCustomerTime(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      showCustomerTime ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {showCustomerTime ? formatDateTime(customerSignedAt) : 'Time'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { customerSigCanvas.current?.clear(); setCustomerSignedAt(null); setShowCustomerTime(false); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1.5 block">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={e => {
                  const val = e.target.value;
                  setCustomerName(val);
                  // Clear the signature if name is erased — a nameless sig is meaningless
                  if (!val.trim()) {
                    customerSigCanvas.current?.clear();
                    setCustomerSignedAt(null);
                    setShowCustomerTime(false);
                  }
                }}
                placeholder="Enter customer full name"
                className={inputCls}
              />
            </div>
          </div>
          <div className="relative mx-4 sm:mx-5 mb-1 border border-border rounded-xl overflow-hidden bg-muted/30" style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={customerSigCanvas}
              canvasProps={{ className: 'w-full', style: { width: '100%', height: 160 } }}
              penColor="hsl(220, 25%, 10%)"
              backgroundColor="transparent"
              onEnd={() => {
                // Guard: only stamp timestamp when name is filled
                if (!customerName.trim()) {
                  customerSigCanvas.current?.clear();
                  toast.error('Enter customer name above before signing.');
                  return;
                }
                setCustomerSignedAt(prev => prev ?? new Date().toISOString());
              }}
            />
            {/* Overlay blocks the pad when name is empty */}
            {!customerName.trim() && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/60 backdrop-blur-[2px] cursor-not-allowed select-none">
                <p className="text-xs font-medium text-muted-foreground text-center px-4">
                  Enter customer name above to unlock signature
                </p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground px-4 sm:px-5 pb-4 mt-2">
            By signing, the customer acknowledges the recorded vehicle condition.
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

      {/* Add Damage Modal */}
      {showDamageModal && (
        <DamageModal
          onSubmit={handleAddDamage}
          onClose={() => { setShowDamageModal(false); setClickCoords(null); }}
          view={clickView}
        />
      )}

      {/* Edit Damage Modal */}
      {editingDamageIdx !== null && (
        <DamageModal
          onSubmit={handleUpdateDamage}
          onClose={() => setEditingDamageIdx(null)}
          view={damages[editingDamageIdx]?.view}
          initialValues={editingDamageIdx !== null ? {
            part: damages[editingDamageIdx].part,
            damage_type: damages[editingDamageIdx].damage_type,
            severity: damages[editingDamageIdx].severity,
            photo_url: damages[editingDamageIdx].photo_url,
          } : undefined}
        />
      )}
    </div>
  );
};

export default InspectionView;
