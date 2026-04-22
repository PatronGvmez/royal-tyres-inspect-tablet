import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchInspectionReport, fetchJobCardById, fetchJobPhotos, getUserProfile } from '@/lib/firestore';
import { mockJobCards } from '@/data/mock';
import { ArrowLeft, Loader2, Gauge, Fuel, Car, AlertTriangle, CheckCircle2, Sun, Moon, Wrench, User as UserIcon } from 'lucide-react';
import { User } from '@/types';
import { buildTyreOverlays, TYRE_CONDITIONS } from '@/lib/tyreUtils';
import { useTheme } from '@/hooks/use-theme';
import CarDiagram from '@/components/inspection/CarDiagram';
import { vehicleViewSVGs, VehicleType } from '@/components/inspection/VehicleSVGs';

const fuelLevelWidths: Record<string, string> = {
  Empty: 'w-0',
  '1/4': 'w-1/4',
  '1/2': 'w-1/2',
  '3/4': 'w-3/4',
  Full: 'w-full',
};

const severityColor: Record<string, string> = {
  minor: 'bg-warning/10 text-warning border border-warning/30',
  major: 'bg-destructive/10 text-destructive border border-destructive/30',
};

const InspectionReportView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const mock = mockJobCards.find(j => j.id === id);
      if (mock) return mock;
      try { return await fetchJobCardById(id!); } catch { return null; }
    },
    enabled: !!id,
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['inspection_report', id],
    queryFn: () => fetchInspectionReport(id!),
    enabled: !!id,
  });

  const { data: photos = {} } = useQuery({
    queryKey: ['job_photos', id],
    queryFn: () => fetchJobPhotos(id!),
    enabled: !!id,
  });

  const { data: mechanic } = useQuery<User | null>({
    queryKey: ['user', job?.mechanic_id],
    queryFn: () => getUserProfile(job!.mechanic_id!),
    enabled: !!job?.mechanic_id,
  });

  const isLoading = jobLoading || reportLoading;

  if (isLoading) {
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

  const vehicleType = (vehicleViewSVGs[job.vehicle_type as VehicleType] ? job.vehicle_type : 'sedan') as VehicleType;
  const VehicleImg = vehicleViewSVGs[vehicleType].front;

  const tyreOverlays = (() => {
    if (!report) return {};
    const base = buildTyreOverlays(report.tire_conditions, vehicleType);
    Object.entries(base).forEach(([view, overlays]) => {
      if (!overlays) return;
      // Apply saved drag positions
      overlays.forEach(ov => {
        const pos = report.tyreAdjustments?.[ov.key]?.[view];
        if (pos) { ov.x = pos.x; ov.y = pos.y; }
      });
      // When a real photo is present for this view, only keep overlays that the
      // mechanic explicitly dragged — default SVG positions don't align with photos
      if (photos?.[view as string]) {
        base[view] = overlays.filter(ov => !!report.tyreAdjustments?.[ov.key]?.[view]);
      }
    });
    return base;
  })();

  const sectionCls = 'bg-card border border-border rounded-2xl p-5 space-y-4';
  const headingCls = 'text-xs font-semibold uppercase tracking-widest text-muted-foreground';
  const valueCls = 'text-sm font-semibold text-foreground';
  const labelCls = 'text-xs text-muted-foreground';

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/mechanic')}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-display font-bold text-foreground truncate">Inspection Report</h1>
            <p className="text-xs text-muted-foreground truncate">{job.customer_name} · {job.license_plate}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border">
            {id}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Vehicle Banner ── */}
        <div className="rounded-2xl overflow-hidden border border-border" style={{ background: 'var(--vehicle-card-bg, linear-gradient(135deg, hsl(var(--primary)/0.12), hsl(var(--accent)/0.08)))' }}>
          <div className="relative h-36 flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.18) 0%, hsl(var(--accent)/0.10) 100%)' }}>
            <VehicleImg className="h-28 w-auto drop-shadow-lg pointer-events-none" />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-success/20 border border-success/40 text-success text-[10px] font-bold px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </div>
            <div className="absolute top-3 right-3 text-[10px] font-mono bg-black/40 text-white px-2.5 py-1 rounded-full">{job.license_plate}</div>
          </div>
          <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-t border-border bg-card/60">
            <div>
              <p className="font-display font-bold text-foreground">{job.customer_name}</p>
              <p className="text-xs text-muted-foreground">{job.service_details}</p>
            </div>
            <span className="self-start sm:self-auto text-[10px] font-mono bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border">{job.id}</span>
          </div>
        </div>

        {/* ── Assigned Mechanic ── */}
        <div className={sectionCls}>
          <p className={headingCls}>Assigned Mechanic</p>
          {mechanic ? (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                {mechanic.avatarVariant ? (
                  <img
                    src={['1','2'].includes(mechanic.avatarVariant) ? `/mechanic${mechanic.avatarVariant}.png` : `/mechenic${mechanic.avatarVariant}.png`}
                    alt={mechanic.name}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{mechanic.name}</p>
                <p className="text-xs text-muted-foreground truncate">{mechanic.email}</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize flex items-center gap-1">
                <Wrench className="w-3 h-3" />{mechanic.role}
              </span>
            </div>
          ) : job?.mechanic_id ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading mechanic info...
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No mechanic assigned to this job</p>
          )}
        </div>

        {/* ── No report saved yet ── */}
        {!report && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <p className="font-display font-semibold text-foreground">No inspection report found</p>
            <p className="text-sm text-muted-foreground max-w-sm">This job was marked completed but no inspection report was submitted yet, or it may still be in progress.</p>
          </div>
        )}

        {report && (
          <>
            {/* ── Odometer & Fuel — only shown when data exists ── */}
            {(report.odometer != null || report.fuel_level) && (
              <div className={sectionCls}>
                <p className={headingCls}>Vehicle Status</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Odometer */}
                  {report.odometer != null && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Gauge className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className={labelCls}>Odometer</p>
                        <p className={valueCls}>{report.odometer.toLocaleString()} km</p>
                      </div>
                    </div>
                  )}
                  {/* Fuel Level */}
                  {report.fuel_level && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                      <div className="p-2 rounded-lg bg-success/10">
                        <Fuel className="w-4 h-4 text-success" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={labelCls}>Fuel Level</p>
                        <p className={`${valueCls} mb-1`}>{report.fuel_level}</p>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full bg-success rounded-full transition-all ${fuelLevelWidths[report.fuel_level] ?? 'w-1/2'}`} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tyre Conditions ── */}
            <div className={sectionCls}>
              <p className={headingCls}>Tyre & Alloy Condition</p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['Front Left', report.tire_conditions.front_left],
                    ['Front Right', report.tire_conditions.front_right],
                    ['Rear Left', report.tire_conditions.rear_left],
                    ['Rear Right', report.tire_conditions.rear_right],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="p-3 rounded-xl bg-muted/50 border border-border">
                    <p className={labelCls}>{label}</p>
                    <p className={`${valueCls} mt-0.5`}>
                      {value
                        ? (TYRE_CONDITIONS.find(c => c.value === value)?.label ?? value)
                        : <span className="text-muted-foreground italic font-normal">Not recorded</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Damage Diagram ── */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between">
                <p className={headingCls}>Damage Inspection</p>
                {report.damages.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                    {report.damages.length} damage{report.damages.length > 1 ? 's' : ''} logged
                  </span>
                )}
              </div>

              {/* Read-only diagram — pointer events needed for tab buttons to work */}
              <CarDiagram
                damages={report.damages}
                onAreaClick={() => {}}
                vehicleType={vehicleType}
                photos={photos as Partial<Record<import('@/components/inspection/VehicleSVGs').ViewAngle, string>>}
                tyreOverlays={tyreOverlays as any}
              />

              {/* Damage list */}
              {report.damages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No damage was recorded during this inspection.</p>
              )}
              {report.damages.length > 0 && (
                <div className="space-y-2 mt-1">
                  {report.damages.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{d.part}</span>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">{d.damage_type}</span>
                        {d.view && (
                          <span className="text-[10px] text-muted-foreground capitalize shrink-0">· {d.view} view</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${severityColor[d.severity]}`}>
                        {d.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Customer Signature ── */}
            <div className={sectionCls}>
              <p className={headingCls}>Customer Signature</p>
              {report.signature_url ? (
                <div className="rounded-xl border border-border overflow-hidden bg-white p-2">
                  <img
                    src={report.signature_url}
                    alt="Customer signature"
                    className="w-full max-h-40 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No signature captured</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InspectionReportView;
