import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchJobCardById, fetchInspectionReport, fetchJobPhotos, getUserProfile } from '@/lib/firestore';
import { JobCard, InspectionReport, User } from '@/types';
import { 
  ChevronLeft, Car, Fuel, Gauge, Calendar, Clock, 
  User as UserIcon, FileText, AlertTriangle, CheckCircle, Loader2,
  ClipboardList, Printer, Image, Circle, Wrench
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import CarDiagram from '@/components/inspection/CarDiagram';
import { buildTyreOverlays, TYRE_CONDITIONS } from '@/lib/tyreUtils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const statusLabel: Record<JobCard['status'], string> = {
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const statusClass: Record<JobCard['status'], string> = {
  booked: 'bg-amber-500/10 text-amber-600',
  in_progress: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
};

const InspectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      if (!id) return null;
      return await fetchJobCardById(id);
    },
    enabled: !!id,
  });

  const { data: report, isLoading: reportsLoading } = useQuery({
    queryKey: ['inspection_report', id],
    queryFn: async () => {
      if (!id) return null;
      return await fetchInspectionReport(id);
    },
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

  const isLoading = jobLoading || reportsLoading;
  const preServiceReport = report ?? null;

  /** Safely format various timestamp formats (Firestore Timestamp, epoch ms, ISO string) */
  const formatDate = (dateVal?: unknown) => {
    if (!dateVal) return 'N/A';
    let ms: number | null = null;
    if (typeof dateVal === 'object' && dateVal !== null && 'seconds' in dateVal) {
      ms = (dateVal as { seconds: number }).seconds * 1000;
    } else if (typeof dateVal === 'number') {
      ms = dateVal;
    } else if (typeof dateVal === 'string') {
      // try parsing embedded epoch from job ID format JC-<epoch>
      const parsed = Date.parse(dateVal);
      if (!isNaN(parsed)) ms = parsed;
    }
    if (!ms) return 'N/A';
    const date = new Date(ms);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-ZA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /** Extract a usable date from the job, falling back to the embedded epoch in the job ID */
  const getJobCreatedDate = (j: JobCard) => {
    if (j.created_at) return formatDate(j.created_at);
    // Fallback: extract epoch from JC-<timestamp> ID pattern
    const m = j.id.match(/JC-(\d{10,})/);
    if (m) return formatDate(parseInt(m[1]));
    return 'N/A';
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Invalid inspection ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          userName={user?.name}
          role="Admin"
          onLogout={() => { logout(); navigate('/'); }}
          maxWidth="max-w-6xl"
        />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar
          userName={user?.name}
          role="Admin"
          onLogout={() => { logout(); navigate('/'); }}
          maxWidth="max-w-6xl"
        />
        <div className="p-6 max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Inspection not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={user?.name}
        role="Admin"
        onLogout={() => { logout(); navigate('/'); }}
        maxWidth="max-w-6xl"
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold text-foreground">{job.customer_name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass[job.status]}`}>
                {statusLabel[job.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Car className="w-4 h-4" />
                {job.license_plate}
              </span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{job.id}</span>
            </div>
          </div>
          <button
            onClick={() => {
              toast.info('PDF export coming soon');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Job & Vehicle Info */}
          <div className="space-y-6">
            {/* Vehicle Information */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-elevated p-5"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" />
                Vehicle Information
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Registration</span>
                  <span className="text-sm font-mono font-bold text-foreground">{job.vehicle_info?.registration_number || job.license_plate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Make</span>
                  <span className="text-sm font-medium text-foreground">{job.vehicle_info?.make || job.make || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Model</span>
                  <span className="text-sm font-medium text-foreground">{job.vehicle_info?.model || job.model || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Year</span>
                  <span className="text-sm font-medium text-foreground">{job.vehicle_info?.year || job.year || 'N/A'}</span>
                </div>
                {(job.vehicle_info?.color) && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Color</span>
                    <span className="text-sm font-medium text-foreground">{job.vehicle_info.color}</span>
                  </div>
                )}
                {job.vehicle_type && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">{job.vehicle_type}</span>
                  </div>
                )}
                {(job.vehicle_info?.vin) && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">VIN</span>
                    <span className="text-xs font-mono text-foreground">{job.vehicle_info.vin}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Service Details */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-elevated p-5"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Service Details
              </h2>
              <p className="text-sm text-muted-foreground">{job.service_details || 'No details provided'}</p>
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Created</span>
                  <span className="text-foreground">{getJobCreatedDate(job)}</span>
                </div>
                {job.updated_at && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Last Updated</span>
                    <span className="text-foreground">{formatDate(job.updated_at)}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Assigned Mechanic */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-elevated p-5"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Assigned Mechanic
              </h2>
              {mechanic ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {mechanic.avatarVariant ? (
                      <img
                        src={['1','2'].includes(mechanic.avatarVariant!) ? `/mechanic${mechanic.avatarVariant}.png` : `/mechenic${mechanic.avatarVariant}.png`}
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
                    <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{mechanic.role}</span>
                  </div>
                </div>
              ) : job?.mechanic_id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading mechanic...
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No mechanic assigned</p>
              )}
            </motion.div>
          </div>

          {/* Right Column - Inspection Reports */}
          <div className="lg:col-span-2 space-y-6">
            {!preServiceReport ? (
              <div className="card-elevated p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No inspection report yet</p>
                <p className="text-xs text-muted-foreground mt-1">Report will appear here once the inspection is submitted</p>
              </div>
            ) : (
              <ReportCard
                report={preServiceReport}
                type="Pre-Service"
                photos={photos as Record<string, string>}
                vehicleType={job.vehicle_type ?? 'sedan'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportCard = ({ report, type, photos, vehicleType = 'sedan' }: { report: InspectionReport; type: string; photos?: Record<string, string>; vehicleType?: string }) => {
  const [showDamageMap, setShowDamageMap] = useState(true);
  const [showSignature, setShowSignature] = useState(false);

  const tyreOverlays = buildTyreOverlays(report.tire_conditions, vehicleType);

  const fuelLevelMap: Record<string, number> = { 'Empty': 0, '1/4': 25, '1/2': 50, '3/4': 75, 'Full': 100 };
  const fuelPercent = fuelLevelMap[report.fuel_level] ?? 50;

  /** Format report timestamps (Firestore Timestamp or epoch) */
  const formatReportDate = (val?: unknown) => {
    if (!val) return 'N/A';
    let ms: number | null = null;
    if (typeof val === 'object' && val !== null && 'seconds' in val) {
      ms = (val as { seconds: number }).seconds * 1000;
    } else if (typeof val === 'number') {
      ms = val;
    } else if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (!isNaN(parsed)) ms = parsed;
    }
    if (!ms) return 'N/A';
    const d = new Date(ms);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="card-elevated p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          {type} Inspection
        </h2>
        <span className="text-xs text-muted-foreground">
          {formatReportDate(report.created_at)}
        </span>
      </div>

      {/* Odometer & Fuel */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Gauge className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Odometer</span>
          </div>
          <p className="text-lg font-bold font-mono text-foreground">
            {report.odometer > 0 ? `${report.odometer.toLocaleString()} km` : 'Not recorded'}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Fuel className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Fuel Level</span>
          </div>
          <p className="text-lg font-bold text-foreground mb-1.5">{report.fuel_level}</p>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fuelPercent}%`,
                background: fuelPercent > 50 ? 'hsl(var(--success))' : fuelPercent > 25 ? 'hsl(var(--warning))' : 'hsl(var(--accent))',
              }}
            />
          </div>
        </div>
      </div>

      {/* Tyre Conditions */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Circle className="w-3 h-3" />
          Tyre &amp; Alloy Condition
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(report.tire_conditions).map(([key, value]) => {
            const hasCondition = value && value.trim() !== '';
            return (
              <div key={key} className={`rounded-lg p-3 border ${hasCondition ? 'bg-muted border-border' : 'bg-accent/5 border-accent/20'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${hasCondition ? 'bg-success' : 'bg-accent'}`} />
                  <p className="text-[10px] text-muted-foreground capitalize font-medium">{key.replace(/_/g, ' ')}</p>
                </div>
                <p className={`text-sm font-medium ${hasCondition ? 'text-foreground' : 'text-accent italic'}`}>
                  {hasCondition
                    ? (TYRE_CONDITIONS.find(c => c.value === value)?.label ?? value)
                    : 'Not recorded'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Damage Map */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Damage Map</h3>
          <button
            onClick={() => setShowDamageMap(!showDamageMap)}
            className="text-xs text-primary hover:underline"
          >
            {showDamageMap ? 'Hide' : 'Show'}
          </button>
        </div>
        {showDamageMap && (
          <CarDiagram
            damages={report.damages}
            onAreaClick={() => {}}
            photos={photos as any}
            vehicleType={vehicleType as any}
            tyreOverlays={tyreOverlays as any}
          />
        )}
      </div>

      {/* Damage List */}
      {report.damages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Damage Details ({report.damages.length})
          </h3>
          {report.damages.map((damage, index) => (
            <div key={index} className="rounded-lg bg-muted overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${damage.severity === 'major' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="text-sm text-foreground font-medium flex-1">{damage.part}</span>
                <span className="text-xs text-muted-foreground capitalize">{damage.damage_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  damage.severity === 'major' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
                }`}>
                  {damage.severity}
                </span>
                {damage.photo_url && (
                  <span className="text-xs text-primary flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    Photo
                  </span>
                )}
              </div>
              {damage.photo_url && (
                <img 
                  src={damage.photo_url} 
                  alt={`Damage to ${damage.part}`}
                  className="w-full h-32 object-cover border-t border-border"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {report.damages.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-600 font-medium">No damage recorded</span>
        </div>
      )}

      {/* Signature */}
      {report.signature_url && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Signature</h3>
            <button
              onClick={() => setShowSignature(v => !v)}
              className="text-xs text-primary hover:underline"
            >
              {showSignature ? 'Hide' : 'View Signature'}
            </button>
          </div>
          {showSignature ? (
            <div className="border border-border rounded-lg overflow-hidden bg-white">
              <img
                src={report.signature_url}
                alt="Customer signature"
                className="w-full h-auto max-h-40 object-contain p-2"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Signature captured</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default InspectionDetail;
