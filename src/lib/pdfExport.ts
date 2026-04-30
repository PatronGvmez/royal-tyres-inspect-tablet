/**
 * pdfExport.ts — Royal Tyres Inspection PDF generator (max 2 pages, A4 portrait)
 *
 * Page 1: Header banner · job summary · vehicle info · intake photos ·
 *         tyre conditions grid · odometer/fuel · damage table
 * Page 2: Vehicle angle photos · damage map · damage photos · signatures
 */

import { jsPDF } from 'jspdf';
import { JobCard, InspectionReport, VehicleDamage, User } from '@/types';
import { TYRE_CONDITIONS, TYRE_POSITIONS } from './tyreUtils';

// ── Vehicle image map: type → view → { src, flip horizontally } ──────────────
const VEHICLE_IMAGE_MAP: Record<string, Record<string, { src: string; flip: boolean }>> = {
  sedan:     { front: { src: '/sedanfront.png',        flip: false },
               rear:  { src: '/sedanback.png',         flip: false },
               left:  { src: '/sedanright.png',        flip: true  },
               right: { src: '/sedanright.png',        flip: false } },
  hatchback: { front: { src: '/hatchback-front.png',   flip: false },
               rear:  { src: '/hatchback-rear.png',    flip: false },
               left:  { src: '/hatchback-left.png',    flip: false },
               right: { src: '/hatchback-left.png',    flip: true  } },
  suv:       { front: { src: '/SUV_Front.png',         flip: false },
               rear:  { src: '/SUV_BACK.png',          flip: false },
               left:  { src: '/SUV_LEFT_SIDE.png',     flip: false },
               right: { src: '/SUV_LEFT_SIDE.png',     flip: true  } },
  bakkie:    { front: { src: '/bakkie_front.png',      flip: false },
               rear:  { src: '/bakkie_back.png',       flip: false },
               left:  { src: '/bakkie_right_side.png', flip: true  },
               right: { src: '/bakkie_right_side.png', flip: false } },
  truck:     { front: { src: '/Truck_front.png',       flip: false },
               rear:  { src: '/Truck_back.png',        flip: false },
               left:  { src: '/Truck_left_side.png',   flip: false },
               right: { src: '/Truck_left_side.png',   flip: true  } },
};

// Damage type → pin colour (hex)
const DMG_PIN_COLORS: Record<string, string> = {
  scratch: '#dc2626',
  dent:    '#d97706',
  crack:   '#7c3aed',
};

/**
 * Renders a vehicle diagram view onto an offscreen <canvas>: vehicle PNG with
 * object-contain scaling (+ optional flip) and numbered coloured damage pins.
 * Returns a PNG data-URL, or null if the vehicle image fails to load.
 */
async function renderDiagramView(
  vehicleType: string,
  view: string,
  pinDamages: Array<{ d: VehicleDamage; globalIndex: number }>,
): Promise<string | null> {
  const typeMap = VEHICLE_IMAGE_MAP[vehicleType?.toLowerCase()] ?? VEHICLE_IMAGE_MAP.suv;
  const info = typeMap[view];
  if (!info) return null;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = await new Promise<boolean>(resolve => {
    img.onload  = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = info.src;
  });
  if (!loaded) return null;

  const CW2 = 400, CH2 = 300;
  const canvas = document.createElement('canvas');
  canvas.width = CW2; canvas.height = CH2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Light background matching the app diagram
  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, CW2, CH2);

  // object-contain scaling
  const scale = Math.min(CW2 / img.naturalWidth, CH2 / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const ox = (CW2 - dw) / 2, oy = (CH2 - dh) / 2;

  if (info.flip) {
    ctx.save(); ctx.translate(CW2, 0); ctx.scale(-1, 1);
    ctx.drawImage(img, CW2 - ox - dw, oy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, ox, oy, dw, dh);
  }

  // Draw numbered coloured pins
  pinDamages.forEach(({ d, globalIndex }) => {
    const px = (d.coordinates.x / 100) * CW2;
    const py = (d.coordinates.y / 100) * CH2;
    const r  = d.severity === 'major' ? 12 : 9;
    const color = DMG_PIN_COLORS[d.damage_type] ?? '#dc2626';

    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
    // White halo
    ctx.beginPath(); ctx.arc(px, py, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.shadowBlur = 0;
    // Colour fill
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    // Number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${r >= 11 ? 13 : 11}px Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(globalIndex + 1), px, py);
  });

  return canvas.toDataURL('image/png');
}

// ── A4 portrait geometry (mm) ──────────────────────────────────────────────
const PW    = 210;
const PH    = 297;
const M     = 14;           // margin → CW = 182
const CW    = PW - M * 2;
const HDR_H = 18;
const BODY_Y = HDR_H + 7;
const FOOT_Y = PH - 7;

type RGB = [number, number, number];

const C = {
  navy:      [12,  28,  68]  as RGB,
  navyLight: [26,  52, 110]  as RGB,
  red:       [200, 30,  40]  as RGB,
  redLight:  [254, 242, 242] as RGB,
  success:   [22,  119, 60]  as RGB,
  successBg: [240, 253, 244] as RGB,
  warning:   [161, 72,   0]  as RGB,
  warningBg: [255, 247, 237] as RGB,
  error:     [180, 24,  24]  as RGB,
  errorBg:   [254, 242, 242] as RGB,
  text:      [15,  23,  42]  as RGB,
  muted:     [100, 116, 139] as RGB,
  mutedLt:   [148, 163, 184] as RGB,
  border:    [226, 232, 240] as RGB,
  bgLight:   [248, 250, 252] as RGB,
  bgAlt:     [241, 245, 249] as RGB,
  white:     [255, 255, 255] as RGB,
};

const STATUS_COLORS: Record<string, RGB> = {
  completed:   C.success,
  in_progress: C.warning,
  booked:      C.navy,
};
const STATUS_BG: Record<string, RGB> = {
  completed:   C.successBg,
  in_progress: C.warningBg,
  booked:      [219, 234, 254] as RGB,
};
const STATUS_LABELS: Record<string, string> = {
  completed:   'COMPLETED',
  in_progress: 'IN PROGRESS',
  booked:      'BOOKED',
};
const TYRE_COND_COLORS: Record<string, RGB> = {
  very_bad: C.error,
  fair:     C.warning,
  good:     C.success,
};
const TYRE_COND_BG: Record<string, RGB> = {
  very_bad: C.errorBg,
  fair:     C.warningBg,
  good:     C.successBg,
};
const VIEW_LABELS: Record<string, string> = {
  front: 'Front View',
  rear:  'Rear View',
  left:  'Left Side',
  right: 'Right Side',
  top:   'Top View',
};

// ── Colour helpers ────────────────────────────────────────────────────────
function tf(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function ff(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function df(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

// ── Date helpers ──────────────────────────────────────────────────────────
function fmtDate(val?: unknown): string {
  if (!val) return 'N/A';
  let ms: number | null = null;
  if (typeof val === 'object' && val !== null && 'seconds' in val)
    ms = (val as { seconds: number }).seconds * 1000;
  else if (typeof val === 'number') ms = val;
  else if (typeof val === 'string') { const p = Date.parse(val); if (!isNaN(p)) ms = p; }
  if (!ms) return 'N/A';
  const d = new Date(ms);
  return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtSigned(val?: string): string {
  if (!val) return '';
  const p = Date.parse(val);
  return isNaN(p) ? val : new Date(p).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Image helper ──────────────────────────────────────────────────────────
function placeImage(doc: jsPDF, url: string | undefined, x: number, y: number, w: number, h: number): boolean {
  if (!url || url.length < 50) return false;
  try {
    doc.addImage(url, url.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, w, h);
    return true;
  } catch { return false; }
}

// ── Page chrome ───────────────────────────────────────────────────────────
function pageHeader(doc: jsPDF, pg: number, total: number, subtitle?: string) {
  // Background
  ff(doc, C.navy); doc.rect(0, 0, PW, HDR_H, 'F');
  // Red accent line
  ff(doc, C.red);  doc.rect(0, HDR_H, PW, 1.5, 'F');

  // Logo wordmark
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); tf(doc, C.white);
  doc.text('ROYAL TYRES', M, 11.5);

  // Subtitle centred
  if (subtitle) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    tf(doc, [150, 180, 220] as RGB);
    doc.text(subtitle, PW / 2, 11.5, { align: 'center' });
  }

  // Page number
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); tf(doc, [150, 180, 220] as RGB);
  doc.text(`Page ${pg} / ${total}`, PW - M, 11.5, { align: 'right' });
}

function pageFooter(doc: jsPDF, jobId: string, generated: string) {
  // Thin separator
  ff(doc, C.bgAlt); doc.rect(0, PH - 10, PW, 10, 'F');
  df(doc, C.border); doc.setLineWidth(0.3);
  doc.line(0, PH - 10, PW, PH - 10);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, C.muted);
  doc.text(`Job: ${jobId}`, M, FOOT_Y);
  doc.text(`Generated: ${generated}`, PW / 2, FOOT_Y, { align: 'center' });
  doc.text('Royal Tyres Inspection System', PW - M, FOOT_Y, { align: 'right' });
}

/** Draws a section heading with accent underline. Returns y after the heading. */
function sectionHeading(doc: jsPDF, text: string, y: number): number {
  // Pill background
  const tw = doc.setFont('helvetica', 'bold').setFontSize(7).getTextWidth(text.toUpperCase());
  ff(doc, C.bgAlt); doc.rect(M - 1, y - 4.5, tw + 10, 6.5, 'F');
  // Left accent bar
  ff(doc, C.red); doc.rect(M - 1, y - 4.5, 2.5, 6.5, 'F');
  tf(doc, C.navy);
  doc.text(text.toUpperCase(), M + 3, y);
  // Full-width rule below
  df(doc, C.border); doc.setLineWidth(0.3);
  doc.line(M, y + 2.5, PW - M, y + 2.5);
  return y + 8;
}

/** Two-column key–value row. */
function kv(doc: jsPDF, label: string, value: string, x: number, y: number, labelW = 26) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); tf(doc, C.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); tf(doc, C.text);
  const maxW = CW / 2 - labelW - 4;
  let v = value || 'N/A';
  while (doc.getTextWidth(v) > maxW && v.length > 4) v = v.slice(0, -4) + '…';
  doc.text(v, x + labelW, y);
}

/**
 * Image card: photo + dark caption bar.
 * Total height consumed = h + 7 mm.
 */
function imageBox(doc: jsPDF, url: string | undefined, label: string, x: number, y: number, w: number, h: number) {
  // Card shadow effect (thin dark border offset)
  ff(doc, [210, 218, 230] as RGB); doc.rect(x + 0.6, y + 0.6, w, h + 7, 'F');
  // Card body
  ff(doc, C.bgLight); df(doc, C.border); doc.setLineWidth(0.2);
  doc.rect(x, y, w, h + 7, 'FD');
  if (!placeImage(doc, url, x + 0.5, y + 0.5, w - 1, h - 1)) {
    ff(doc, C.bgAlt); doc.rect(x + 0.5, y + 0.5, w - 1, h - 1, 'F');
    doc.setFont('helvetica', 'italic'); doc.setFontSize(5.5); tf(doc, C.mutedLt);
    doc.text('No image', x + w / 2, y + h / 2, { align: 'center' });
  }
  // Caption bar
  ff(doc, C.navy); doc.rect(x, y + h, w, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); tf(doc, C.white);
  let lb = label;
  while (doc.getTextWidth(lb) > w - 4 && lb.length > 4) lb = lb.slice(0, -4) + '…';
  doc.text(lb, x + w / 2, y + h + 4.8, { align: 'center' });
}

// ── Public API ────────────────────────────────────────────────────────────

export interface PDFExportData {
  job:      JobCard;
  report:   InspectionReport | null;
  /** Per-angle vehicle photos from job_photos collection */
  photos:   Partial<Record<string, string>>;
  mechanic: User | null;
}

export async function generateInspectionPDF(
  { job, report, photos, mechanic }: PDFExportData,
): Promise<void> {
  const angleEntries = (Object.entries(photos) as [string, string][]).filter(([, u]) => !!u);
  const dmgPhotos    = (report?.damages ?? []).filter(d => !!d.photo_url).slice(0, 6);

  // Pre-render damage diagrams
  const viewsWithDamages = new Map<string, Array<{ d: VehicleDamage; globalIndex: number }>>();
  (report?.damages ?? []).forEach((d, i) => {
    if (!d.view || d.view === 'top') return;
    if (!viewsWithDamages.has(d.view)) viewsWithDamages.set(d.view, []);
    viewsWithDamages.get(d.view)!.push({ d, globalIndex: i });
  });
  const diagramCanvases = new Map<string, string>();
  for (const [view, pins] of viewsWithDamages) {
    const dataUrl = await renderDiagramView(job.vehicle_type ?? 'suv', view, pins);
    if (dataUrl) diagramCanvases.set(view, dataUrl);
  }

  const hasPage2   = !!report || angleEntries.length > 0 || diagramCanvases.size > 0;
  const totalPages = hasPage2 ? 2 : 1;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generated = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const col2  = M + CW / 2 + 2;
  const ROW   = 5.8;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ═══════════════════════════════════════════════════════════════════════════
  pageHeader(doc, 1, totalPages, 'Pre-Service Inspection Report');
  pageFooter(doc, job.id, generated);
  let y = BODY_Y + 2;

  // ── Job summary banner ─────────────────────────────────────────────────
  // Tinted background strip
  ff(doc, C.bgAlt); doc.rect(M - 2, y - 3, CW + 4, 28, 'F');
  df(doc, C.border); doc.setLineWidth(0.3);
  doc.rect(M - 2, y - 3, CW + 4, 28, 'S');
  // Left accent bar (navy)
  ff(doc, C.navy); doc.rect(M - 2, y - 3, 3, 28, 'F');

  // Status badge (top-right of banner)
  const sl = STATUS_LABELS[job.status] ?? job.status.toUpperCase();
  const sc = STATUS_COLORS[job.status] ?? C.muted;
  const sb = STATUS_BG[job.status] ?? C.bgAlt;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
  const bw = doc.getTextWidth(sl) + 8;
  ff(doc, sb); df(doc, sc); doc.setLineWidth(0.5);
  doc.rect(PW - M - bw, y - 1, bw, 6, 'FD');
  tf(doc, sc); doc.text(sl, PW - M - bw / 2, y + 3.5, { align: 'center' });

  // Customer name (large)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); tf(doc, C.navy);
  doc.text(job.customer_name, M + 4, y + 5);

  // License plate pill
  const lp = job.license_plate;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); tf(doc, C.white);
  const lpw = doc.getTextWidth(lp) + 6;
  ff(doc, C.navy); doc.rect(M + 4, y + 7.5, lpw, 6, 'F');
  doc.text(lp, M + 4 + lpw / 2, y + 12, { align: 'center' });

  // Job ID + date
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tf(doc, C.muted);
  doc.text(`${job.id}  ·  ${fmtDate(job.created_at)}`, M + lpw + 8, y + 11.5);

  // Service line
  if (job.service_details) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); tf(doc, C.red);
    doc.text(job.service_details, M + 4, y + 21);
  }
  y += 32;

  // ── Vehicle Information ─────────────────────────────────────────────────
  y = sectionHeading(doc, 'Vehicle Information', y);

  // Alternating rows across 2 columns
  const vPairs: Array<[string, string, string, string]> = [
    ['Registration', job.license_plate,
     'Type',         job.vehicle_type ? job.vehicle_type.charAt(0).toUpperCase() + job.vehicle_type.slice(1) : 'N/A'],
    ['Make',         job.make  || 'N/A',
     'Odometer',     job.odometer ? `${job.odometer.toLocaleString()} km` : 'N/A'],
    ['Model',        job.model || 'N/A',
     'Mechanic',     mechanic?.name  || 'Unassigned'],
    ['Year',         job.year  ? String(job.year) : 'N/A',
     'Contact',      mechanic?.email || 'N/A'],
  ];
  vPairs.forEach(([ll, lv, rl, rv], i) => {
    const ry = y + i * ROW;
    if (i % 2 === 0) { ff(doc, C.bgAlt); doc.rect(M - 2, ry - 4, CW + 4, ROW, 'F'); }
    kv(doc, ll, lv, M,    ry);
    kv(doc, rl, rv, col2, ry);
  });
  y += vPairs.length * ROW + 5;

  // ── Intake Photos ────────────────────────────────────────────────────────
  if (job.license_plate_photo || job.disk_photo) {
    y = sectionHeading(doc, 'Intake Photos', y);
    const iw = (CW - 5) / 2;
    const ih = 28;
    imageBox(doc, job.license_plate_photo, 'License Plate', M,          y, iw, ih);
    imageBox(doc, job.disk_photo,          'License Disk',  M + iw + 5, y, iw, ih);
    y += ih + 10;
  }

  if (!report) {
    ff(doc, C.successBg); df(doc, [134, 239, 172] as RGB); doc.setLineWidth(0.25);
    doc.rect(M, y, CW, 12, 'FD');
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); tf(doc, C.muted);
    doc.text('No inspection report submitted for this job yet.', PW / 2, y + 8, { align: 'center' });
    doc.save(`RT-Inspection-${job.id}.pdf`);
    return;
  }

  // ── Inspection Findings: odometer + fuel ─────────────────────────────────
  y = sectionHeading(doc, 'Inspection Findings', y);
  ff(doc, C.bgAlt); doc.rect(M - 2, y - 4, CW + 4, ROW, 'F');
  const odo = report.odometer ?? job.odometer;
  kv(doc, 'Odometer',   odo ? `${odo.toLocaleString()} km` : 'Not recorded', M,    y);
  kv(doc, 'Fuel Level', report.fuel_level || 'N/A',                           col2, y);
  y += ROW + 6;

  // ── Tyre & Alloy Condition ────────────────────────────────────────────────
  y = sectionHeading(doc, 'Tyre & Alloy Condition', y);
  const tbw = (CW - 5) / 2;
  const tbh = 14;
  const positions = [
    { x: M,           yt: y },
    { x: M + tbw + 5, yt: y },
    { x: M,           yt: y + tbh + 4 },
    { x: M + tbw + 5, yt: y + tbh + 4 },
  ];
  TYRE_POSITIONS.forEach(({ key, label }, i) => {
    const val   = report.tire_conditions[key as keyof typeof report.tire_conditions];
    const cond  = TYRE_CONDITIONS.find(c => c.value === val);
    const col   = TYRE_COND_COLORS[val ?? ''] ?? C.muted;
    const bgCol = TYRE_COND_BG[val ?? ''] ?? C.bgLight;
    const pos   = positions[i];

    // Card bg
    ff(doc, bgCol); df(doc, col); doc.setLineWidth(0.5);
    doc.rect(pos.x, pos.yt, tbw, tbh, 'FD');
    // Left colour bar
    ff(doc, col); doc.rect(pos.x, pos.yt, 3.5, tbh, 'F');
    // Position label
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tf(doc, C.muted);
    doc.text(label, pos.x + 6, pos.yt + 5.5);
    // Condition value
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); tf(doc, col);
    doc.text(cond?.label ?? 'Not recorded', pos.x + 6, pos.yt + 11.5);
  });
  y += (tbh + 4) * 2 + 5;

  // ── Damage Table ──────────────────────────────────────────────────────────
  const dmgTitle = report.damages.length === 0
    ? 'Damage Inspection'
    : `Damage Inspection  (${report.damages.length} item${report.damages.length !== 1 ? 's' : ''})`;
  y = sectionHeading(doc, dmgTitle, y);

  if (report.damages.length === 0) {
    ff(doc, C.successBg); df(doc, [134, 239, 172] as RGB); doc.setLineWidth(0.25);
    doc.rect(M, y, CW, 11, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); tf(doc, C.success);
    doc.text('✓  No damage recorded during this inspection', PW / 2, y + 7.5, { align: 'center' });
    y += 16;
  } else {
    const tcols = [
      { label: '#',     x: M + 2,   w: 8  },
      { label: 'Part',  x: M + 10,  w: 48 },
      { label: 'Type',  x: M + 58,  w: 28 },
      { label: 'Sev.',  x: M + 90,  w: 22 },
      { label: 'View',  x: M + 114, w: 22 },
      { label: 'Photo', x: M + 138, w: 16 },
    ];
    // Header row
    ff(doc, C.navyLight); doc.rect(M, y, CW, 6.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
    tcols.forEach(c => doc.text(c.label, c.x, y + 4.5));
    y += 6.5;

    report.damages.forEach((d, i) => {
      const ry = y + i * ROW;
      // Alternating row
      if (i % 2 === 0) { ff(doc, C.bgAlt); doc.rect(M, ry, CW, ROW, 'F'); }
      // Number
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.navyLight);
      doc.text(String(i + 1), tcols[0].x, ry + 4);
      // Part
      doc.setFont('helvetica', 'normal'); tf(doc, C.text);
      doc.text(d.part,        tcols[1].x, ry + 4);
      // Type — capitalise
      doc.text(d.damage_type.charAt(0).toUpperCase() + d.damage_type.slice(1), tcols[2].x, ry + 4);
      // Severity — coloured bold
      doc.setFont('helvetica', 'bold');
      tf(doc, d.severity === 'major' ? C.error : C.warning);
      doc.text(d.severity === 'major' ? 'Major' : 'Minor', tcols[3].x, ry + 4);
      // View
      doc.setFont('helvetica', 'normal'); tf(doc, C.muted);
      doc.text(d.view ? (VIEW_LABELS[d.view] ?? d.view) : '—', tcols[4].x, ry + 4);
      // Photo checkmark
      tf(doc, d.photo_url ? C.success : C.mutedLt);
      doc.text(d.photo_url ? '✓' : '—', tcols[5].x, ry + 4);
    });

    // Table border
    df(doc, C.border); doc.setLineWidth(0.25);
    doc.rect(M, y - 6.5, CW, 6.5 + report.damages.length * ROW, 'S');
    y += report.damages.length * ROW + 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2
  // ═══════════════════════════════════════════════════════════════════════════
  if (!hasPage2) { doc.save(`RT-Inspection-${job.id}.pdf`); return; }

  doc.addPage();
  pageHeader(doc, 2, totalPages, 'Pre-Service Inspection Report');
  pageFooter(doc, job.id, generated);
  y = BODY_Y + 2;

  // ── Vehicle Angle Photos ─────────────────────────────────────────────────
  if (angleEntries.length > 0) {
    y = sectionHeading(doc, 'Vehicle Photos — Captured by Inspector', y);
    const aw = (CW - 5) / 2;
    const ah = 22;
    let col = 0;
    for (const [key, url] of angleEntries) {
      imageBox(doc, url, VIEW_LABELS[key] ?? key, M + col * (aw + 5), y, aw, ah);
      col++;
      if (col >= 2) { col = 0; y += ah + 10; }
    }
    if (col > 0) y += ah + 10;
    y += 2;
  }

  // ── Damage Map ───────────────────────────────────────────────────────────
  if (diagramCanvases.size > 0) {
    y = sectionHeading(doc, 'Damage Map — Marked on Vehicle', y);

    // Legend + note on same line
    let lx = M;
    [{ label: 'Scratch', hex: DMG_PIN_COLORS.scratch },
     { label: 'Dent',    hex: DMG_PIN_COLORS.dent    },
     { label: 'Crack',   hex: DMG_PIN_COLORS.crack   }].forEach(({ label, hex }) => {
      const rgb = parseInt(hex.slice(1), 16);
      ff(doc, [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff] as RGB);
      doc.circle(lx + 2.2, y - 1.5, 2.2, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tf(doc, C.muted);
      doc.text(label, lx + 5.5, y - 0.2);
      lx += 5.5 + doc.getTextWidth(label) + 5;
    });
    y += 4;

    const dmw = (CW - 5) / 2;
    const dmh = 22;
    let dmCol = 0;
    for (const [view, dataUrl] of diagramCanvases) {
      imageBox(doc, dataUrl, VIEW_LABELS[view] ?? view, M + dmCol * (dmw + 5), y, dmw, dmh);
      dmCol++;
      if (dmCol >= 2) { dmCol = 0; y += dmh + 10; }
    }
    if (dmCol > 0) y += dmh + 10;
    y += 2;
  }

  // ── Damage Photos ────────────────────────────────────────────────────────
  if (dmgPhotos.length > 0) {
    y = sectionHeading(doc, 'Damage Photos', y);
    const dw = (CW - 10) / 3;
    const dh = 18;
    let col = 0;
    for (const d of dmgPhotos) {
      const lb = `${d.part} — ${d.severity === 'major' ? 'Major' : 'Minor'}`;
      imageBox(doc, d.photo_url, lb, M + col * (dw + 5), y, dw, dh);
      col++;
      if (col >= 3) { col = 0; y += dh + 10; }
    }
    if (col > 0) y += dh + 10;
    const totalDmg = report.damages.filter(d => !!d.photo_url).length;
    if (totalDmg > 6) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); tf(doc, C.muted);
      doc.text(`(${totalDmg - 6} additional damage photo${totalDmg - 6 > 1 ? 's' : ''} available in the system)`, M, y);
      y += 5;
    }
    y += 2;
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  y = sectionHeading(doc, 'Signatures', y);
  const sw    = (CW - 5) / 2;
  const sigH  = 28;
  const sBoxH = sigH + 22;

  const drawSigBox = (
    bx: number, by: number,
    title: string,
    name: string | undefined,
    signedAt: string | undefined,
    sigUrl: string | undefined,
  ) => {
    // Card
    ff(doc, C.bgLight); df(doc, C.border); doc.setLineWidth(0.3);
    doc.rect(bx, by, sw, sBoxH, 'FD');
    // Header bar
    ff(doc, C.navyLight); doc.rect(bx, by, sw, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
    doc.text(title, bx + sw / 2, by + 5.5, { align: 'center' });
    // Name
    let sy = by + 13;
    if (name) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); tf(doc, C.text);
      doc.text(name, bx + 4, sy); sy += 5;
    }
    // Signed date
    if (signedAt) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.muted);
      doc.text(`Signed: ${fmtSigned(signedAt)}`, bx + 4, sy); sy += 4;
    }
    // Signature image area (light tinted)
    ff(doc, C.bgAlt); doc.rect(bx + 3, sy, sw - 6, sigH - 4, 'F');
    if (!placeImage(doc, sigUrl, bx + 3, sy, sw - 6, sigH - 4)) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(6); tf(doc, C.mutedLt);
      doc.text('No signature captured', bx + sw / 2, sy + (sigH - 4) / 2, { align: 'center' });
    }
  };

  drawSigBox(
    M, y,
    'INSPECTOR SIGNATURE',
    report.mechanic_name,
    report.mechanic_signed_at,
    report.mechanic_signature_url,
  );
  drawSigBox(
    M + sw + 5, y,
    'CUSTOMER SIGNATURE',
    report.customer_name || job.customer_name,
    report.customer_signed_at,
    report.customer_signature_url ?? report.signature_url,
  );
  y += sBoxH + 4;

  // ── Disclaimer ────────────────────────────────────────────────────────────
  ff(doc, C.bgAlt); doc.rect(0, y, PW, 8, 'F');
  df(doc, C.border); doc.setLineWidth(0.3); doc.line(0, y, PW, y);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6); tf(doc, C.muted);
  doc.text('Official pre-service inspection record — Royal Tyres Inspection System', PW / 2, y + 3.2, { align: 'center' });
  doc.text(`Generated: ${generated}`, PW / 2, y + 6.2, { align: 'center' });

  doc.save(`RT-Inspection-${job.id}.pdf`);
}
