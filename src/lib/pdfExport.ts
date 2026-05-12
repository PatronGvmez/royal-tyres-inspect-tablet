/**
 * pdfExport.ts — Royal Tyres Inspection PDF  (modern redesign)
 *
 * Page 1: Header · hero summary card · vehicle info cards · intake photos ·
 *         findings strip · tyre condition tiles · damage table
 * Page 2: Vehicle angle photos · damage photos · signature cards · disclaimer
 */

import { jsPDF } from 'jspdf';
import { JobCard, InspectionReport, User } from '@/types';
import { TYRE_CONDITIONS, TYRE_POSITIONS } from './tyreUtils';

// ── A4 portrait geometry (mm) ──────────────────────────────────────────────
const PW    = 210;
const PH    = 297;
const M     = 13;
const CW    = PW - M * 2;
const HDR_H = 23;
const BODY_Y = HDR_H + 5;
const FOOT_Y = PH - 4;
const ROW   = 6;

type RGB = [number, number, number];

// ── Brand palette ──────────────────────────────────────────────────────────
const C = {
  navy:       [8,   22,  60]  as RGB,
  navyMid:    [16,  42,  96]  as RGB,
  navyLight:  [28,  60, 130]  as RGB,
  accent:     [216, 28,  42]  as RGB,
  accentSoft: [255, 237, 238] as RGB,
  accentBdr:  [252, 165, 165] as RGB,
  gold:       [200, 150,  10]  as RGB,
  goldBg:     [255, 251, 225] as RGB,
  goldBdr:    [202, 168,  50]  as RGB,
  success:    [14,  116,  56]  as RGB,
  successBg:  [236, 253, 245] as RGB,
  successBdr: [110, 231, 163] as RGB,
  warning:    [146,  70,   0]  as RGB,
  warningBg:  [255, 247, 237] as RGB,
  warningBdr: [251, 191,  36]  as RGB,
  error:      [180,  24,  24]  as RGB,
  errorBg:    [254, 242, 242] as RGB,
  errorBdr:   [252, 165, 165] as RGB,
  text:       [14,  20,  38]  as RGB,
  textMid:    [50,  60,  80]  as RGB,
  muted:      [100, 112, 128] as RGB,
  mutedLt:    [155, 165, 180] as RGB,
  border:     [220, 228, 240] as RGB,
  borderMid:  [196, 208, 224] as RGB,
  bg:         [248, 249, 252] as RGB,
  bgCard:     [255, 255, 255] as RGB,
  bgAlt:      [242, 245, 250] as RGB,
  bgDeep:     [232, 237, 246] as RGB,
  white:      [255, 255, 255] as RGB,
};

const STATUS_COLORS: Record<string, RGB> = {
  completed:   C.success,
  in_progress: C.warning,
  booked:      C.navyLight,
};
const STATUS_BG: Record<string, RGB> = {
  completed:   C.successBg,
  in_progress: C.warningBg,
  booked:      [216, 232, 255] as RGB,
};
const STATUS_BDR: Record<string, RGB> = {
  completed:   C.successBdr,
  in_progress: C.warningBdr,
  booked:      C.navyLight,
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
const TYRE_COND_BDR: Record<string, RGB> = {
  very_bad: C.errorBdr,
  fair:     C.warningBdr,
  good:     C.successBdr,
};
const VIEW_LABELS: Record<string, string> = {
  front: 'Front View',
  rear:  'Rear View',
  left:  'Left Side',
  right: 'Right Side',
  top:   'Top View',
};

// ── Low-level helpers ─────────────────────────────────────────────────────
function tf(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function ff(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function df(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

/** Rounded rect shorthand (jsPDF 2.x API) */
function rr(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: string) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

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

function placeImage(doc: jsPDF, url: string | undefined, x: number, y: number, w: number, h: number): boolean {
  if (!url || url.length < 50) return false;
  try {
    doc.addImage(url, url.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, w, h);
    return true;
  } catch { return false; }
}

// ── Component helpers ─────────────────────────────────────────────────────

/** Pill badge centered at (cx, cy). */
function pillBadge(doc: jsPDF, text: string, cx: number, cy: number, fg: RGB, bg: RGB, bdr: RGB) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
  const tw = doc.getTextWidth(text);
  const bw = tw + 7, bh = 5.5;
  ff(doc, bg); df(doc, bdr); doc.setLineWidth(0.4);
  rr(doc, cx - bw / 2, cy - bh / 2, bw, bh, 2.5, 'FD');
  tf(doc, fg);
  doc.text(text, cx, cy + 1.8, { align: 'center' });
}

/** Section heading — full-width accent pill bar. Returns new y. */
function sectionHeading(doc: jsPDF, text: string, y: number): number {
  const headH = 7.5;
  ff(doc, C.bgAlt); doc.rect(M - 1, y - 5, CW + 2, headH, 'F');
  ff(doc, C.accent); doc.rect(M - 1, y - 5, 3, headH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); tf(doc, C.navy);
  doc.text(text.trimStart().toUpperCase(), M + 4, y - 0.5);
  df(doc, C.borderMid); doc.setLineWidth(0.25);
  doc.line(M - 1, y + 2.5, PW - M + 1, y + 2.5);
  return y + 8;
}

/**
 * Photo card with rounded corners and navy caption bar.
 * Returns the total height consumed (h + captionH).
 */
function imageCard(
  doc: jsPDF,
  url: string | undefined,
  label: string,
  x: number, y: number, w: number, h: number,
  captionH = 7,
): number {
  const total = h + captionH;
  ff(doc, C.bgDeep); rr(doc, x + 0.8, y + 0.8, w, total, 2.5, 'F');
  ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.2);
  rr(doc, x, y, w, total, 2.5, 'FD');
  if (!placeImage(doc, url, x + 0.5, y + 0.5, w - 1, h - 1)) {
    ff(doc, C.bgAlt); doc.rect(x + 0.5, y + 0.5, w - 1, h - 1, 'F');
    doc.setFont('helvetica', 'italic'); doc.setFontSize(5.5); tf(doc, C.mutedLt);
    doc.text('No photo', x + w / 2, y + h / 2, { align: 'center' });
  }
  ff(doc, C.navy); rr(doc, x, y + h, w, captionH, 2.5, 'F');
  doc.rect(x, y + h, w, captionH / 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); tf(doc, C.white);
  let lb = label;
  while (doc.getTextWidth(lb) > w - 4 && lb.length > 4) lb = lb.slice(0, -4) + '...';
  doc.text(lb, x + w / 2, y + h + captionH * 0.72, { align: 'center' });
  return total;
}

/** Page header — printed once per page. */
function pageHeader(doc: jsPDF, pg: number, total: number) {
  ff(doc, C.navy); doc.rect(0, 0, PW, HDR_H, 'F');
  df(doc, [16, 38, 88] as RGB); doc.setLineWidth(0.5);
  for (let i = 0; i < 7; i++) {
    const lx = PW - 52 + i * 12;
    doc.line(lx, 0, lx - HDR_H * 0.6, HDR_H);
  }
  ff(doc, C.accent); doc.rect(0, HDR_H - 2, PW, 2, 'F');
  ff(doc, C.accent); doc.circle(M + 6, HDR_H / 2, 6, 'F');
  ff(doc, C.white); doc.circle(M + 6, HDR_H / 2, 4.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.accent);
  doc.text('RT', M + 6, HDR_H / 2 + 2.2, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tf(doc, C.white);
  doc.text('ROYAL TYRES', M + 15, HDR_H / 2 + 1.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, [160, 190, 230] as RGB);
  doc.text('PRE-SERVICE INSPECTION REPORT', M + 15, HDR_H / 2 + 7);
  const pageTxt = `PAGE  ${pg} / ${total}`;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
  const pw2 = doc.getTextWidth(pageTxt) + 9;
  ff(doc, C.navyMid); df(doc, C.navyLight); doc.setLineWidth(0.4);
  rr(doc, PW - M - pw2, HDR_H / 2 - 4, pw2, 8, 2, 'FD');
  tf(doc, C.white);
  doc.text(pageTxt, PW - M - pw2 / 2, HDR_H / 2 + 1.5, { align: 'center' });
}

/** Page footer — printed once per page. */
function pageFooter(doc: jsPDF, jobId: string, generated: string) {
  ff(doc, C.bgAlt); doc.rect(0, PH - 9, PW, 9, 'F');
  df(doc, C.borderMid); doc.setLineWidth(0.25);
  doc.line(0, PH - 9, PW, PH - 9);
  ff(doc, C.accent); doc.rect(0, PH - 9, 2.5, 9, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); tf(doc, C.muted);
  doc.text(`Job ID: ${jobId}`, M, FOOT_Y);
  doc.text('Royal Tyres Inspection System  |  Confidential Document', PW / 2, FOOT_Y, { align: 'center' });
  doc.text(`Generated: ${generated}`, PW - M, FOOT_Y, { align: 'right' });
}

// ── Public API ─────────────────────────────────────────────────────────────

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

  const hasPage2   = !!report || angleEntries.length > 0;

  // Pre-estimate whether page 2 content overflows into a 3rd page.
  // Vehicle photo rows × 46mm + damage photo rows × 36mm + signatures block ~84mm.
  const CAPTION_H  = 7;  // imageCard default captionH
  const PH_SAFE    = PH - HDR_H - 9 - (BODY_Y + 1); // usable height per page ≈ 260mm
  const estP2H = (
    (angleEntries.length > 0 ? 8 + Math.ceil(angleEntries.length / 2) * (32 + CAPTION_H + 14) + 4 : 0) +
    (dmgPhotos.length > 0   ? 8 + Math.ceil(dmgPhotos.length   / 3) * (22 + CAPTION_H + 14) + 4 : 0) +
    (hasPage2               ? 8 + 58 + 5 + 18 : 0)
  );
  const totalPages = !hasPage2 ? 1 : (estP2H > PH_SAFE ? 3 : 2);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const generated = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const col2 = M + CW / 2 + 3;
  const colW = CW / 2 - 3;

  // PAGE 1
  pageHeader(doc, 1, totalPages);
  pageFooter(doc, job.id, generated);
  let y = BODY_Y + 1;

  // Hero card
  const heroH = 34;
  ff(doc, C.bgDeep); rr(doc, M - 1 + 0.8, y - 1 + 0.8, CW + 2, heroH, 3, 'F');
  ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.25);
  rr(doc, M - 1, y - 1, CW + 2, heroH, 3, 'FD');
  ff(doc, C.navy); rr(doc, M - 1, y - 1, 5.5, heroH, 3, 'F');
  doc.rect(M + 1.5, y - 1, 3, heroH, 'F');

  const sl   = STATUS_LABELS[job.status] ?? job.status.toUpperCase();
  const sc   = STATUS_COLORS[job.status] ?? C.muted;
  const sbg  = STATUS_BG[job.status] ?? C.bgAlt;
  const sbdr = STATUS_BDR[job.status] ?? C.borderMid;
  pillBadge(doc, sl, PW - M - 16, y + 4, sc, sbg, sbdr);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); tf(doc, C.navy);
  doc.text(job.customer_name, M + 7.5, y + 8.5);

  const lp  = job.license_plate;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  const lpw = doc.getTextWidth(lp) + 10;
  ff(doc, C.goldBg); df(doc, C.goldBdr); doc.setLineWidth(0.9);
  rr(doc, M + 7.5, y + 11, lpw, 7.5, 1.5, 'FD');
  tf(doc, C.text);
  doc.text(lp, M + 7.5 + lpw / 2, y + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.mutedLt);
  doc.text(job.id, M + lpw + 11, y + 16.5);

  if (job.service_details) {
    ff(doc, C.accent); doc.circle(M + 9, y + 24.5, 1.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); tf(doc, C.accent);
    doc.text(job.service_details, M + 13, y + 25.5);
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, C.mutedLt);
  doc.text(`Date: ${fmtDate(job.created_at)}`, M + 7.5, y + 31);
  if (mechanic) {
    doc.text(`Inspector: ${mechanic.name}`, col2, y + 31);
  }
  y += heroH + 8;  // hero card shadow/border ends at y+33, need ≥5mm clearance before next section heading

  // Vehicle info cards
  y = sectionHeading(doc, 'Vehicle Information', y);
  const viH = 30;

  // Left card
  ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.2);
  rr(doc, M, y, colW, viH, 2, 'FD');
  ff(doc, C.navyMid); rr(doc, M, y, colW, 7, 2, 'F');
  doc.rect(M, y + 3.5, colW, 3.5, 'F');
  ff(doc, C.white); doc.circle(M + 5, y + 3.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); tf(doc, C.navyMid);
  doc.text('CAR', M + 5, y + 4.7, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
  doc.text('VEHICLE DETAILS', M + 10, y + 5);

  const leftPairs: [string, string][] = [
    ['Registration', job.license_plate],
    ['Make',         job.make  || 'N/A'],
    ['Model',        job.model || 'N/A'],
    ['Year',         job.year  ? String(job.year) : 'N/A'],
  ];
  leftPairs.forEach(([label, value], i) => {
    const ry = y + 10 + i * ROW;
    if (i % 2 === 0) { ff(doc, C.bg); doc.rect(M + 1, ry - 3.5, colW - 2, ROW, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, C.muted);
    doc.text(label, M + 3, ry);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.text);
    let v = value;
    while (doc.getTextWidth(v) > colW - 26 && v.length > 4) v = v.slice(0, -4) + '...';
    doc.text(v, M + 23, ry);
  });

  // Right card
  ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.2);
  rr(doc, col2, y, colW, viH, 2, 'FD');
  ff(doc, C.navyMid); rr(doc, col2, y, colW, 7, 2, 'F');
  doc.rect(col2, y + 3.5, colW, 3.5, 'F');
  ff(doc, C.white); doc.circle(col2 + 5, y + 3.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); tf(doc, C.navyMid);
  doc.text('SVC', col2 + 5, y + 4.7, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
  doc.text('SERVICE & INSPECTOR', col2 + 10, y + 5);

  const rightPairs: [string, string][] = [
    ['Type',     job.vehicle_type ? job.vehicle_type.charAt(0).toUpperCase() + job.vehicle_type.slice(1) : 'N/A'],
    ['Odometer', job.odometer ? `${job.odometer.toLocaleString()} km` : 'N/A'],
    ['Mechanic', mechanic?.name  || 'Unassigned'],
    ['Contact',  mechanic?.email || 'N/A'],
  ];
  rightPairs.forEach(([label, value], i) => {
    const ry = y + 10 + i * ROW;
    if (i % 2 === 0) { ff(doc, C.bg); doc.rect(col2 + 1, ry - 3.5, colW - 2, ROW, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, C.muted);
    doc.text(label, col2 + 3, ry);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.text);
    let v = value;
    while (doc.getTextWidth(v) > colW - 26 && v.length > 4) v = v.slice(0, -4) + '...';
    doc.text(v, col2 + 23, ry);
  });
  y += viH + 8;  // cards end at y+30, +8 gives 3mm gap before section heading background

  // Intake photos
  const intakePhotos = [
    { url: job.license_plate_photo, label: 'License Plate' },
    { url: job.disk_photo,          label: 'License Disk'  },
    { url: job.odometer_photo,      label: 'Odometer'      },
  ].filter(p => !!p.url);

  if (intakePhotos.length > 0) {
    y = sectionHeading(doc, 'Intake Photos', y);
    const gap = 4;
    const iw  = (CW - gap * (intakePhotos.length - 1)) / intakePhotos.length;
    const ih  = 28;
    intakePhotos.forEach((p, i) => {
      imageCard(doc, p.url, p.label, M + i * (iw + gap), y, iw, ih);
    });
    y += ih + CAPTION_H + 8;  // card draws ih+captionH=35mm; +8 gives 3mm gap before next section heading
  }

  if (!report) {
    ff(doc, C.bgAlt); df(doc, C.border); doc.setLineWidth(0.25);
    rr(doc, M, y, CW, 13, 2, 'FD');
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); tf(doc, C.muted);
    doc.text('No inspection report submitted for this job yet.', PW / 2, y + 8.5, { align: 'center' });
    doc.save(`RT-Inspection-${job.id}.pdf`);
    return;
  }

  // Findings strip (odometer + fuel)
  y = sectionHeading(doc, 'Inspection Findings', y);
  const findH = 13;
  ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.2);
  rr(doc, M, y, CW, findH, 2, 'FD');

  ff(doc, C.navyMid); doc.circle(M + 6, y + findH / 2, 4, 'F');
  ff(doc, C.navyLight); doc.circle(M + 6, y + findH / 2, 2.5, 'F');
  ff(doc, C.white); doc.circle(M + 6, y + findH / 2, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); tf(doc, C.text);
  const odo = report.odometer ?? job.odometer;
  doc.text(odo ? `${odo.toLocaleString()} km` : 'Not recorded', M + 12, y + findH / 2 + 2.8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.muted);
  doc.text('Odometer', M + 12, y + findH / 2 - 1.5);

  df(doc, C.border); doc.setLineWidth(0.3);
  doc.line(col2 - 2, y + 2, col2 - 2, y + findH - 2);

  const fuelPctMap: Record<string, number> = { 'Empty': 0, '1/4': 25, '1/2': 50, '3/4': 75, 'Full': 100 };
  const fuelPct = report.fuel_level ? (fuelPctMap[report.fuel_level] ?? null) : null;
  const fuelColor = fuelPct === null ? C.muted : fuelPct >= 50 ? C.success : fuelPct >= 25 ? C.warning : C.error;
  ff(doc, fuelColor); doc.circle(col2 + 5, y + findH / 2, 4, 'F');
  ff(doc, C.bgCard); doc.circle(col2 + 5, y + findH / 2, 2.5, 'F');
  ff(doc, fuelColor); doc.circle(col2 + 5, y + findH / 2, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); tf(doc, C.text);
  doc.text(report.fuel_level || 'N/A', col2 + 11, y + findH / 2 + 2.8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.muted);
  doc.text('Fuel Level', col2 + 11, y + findH / 2 - 1.5);
  y += findH + 8;  // strip ends at y+13, +8 gives 3mm gap

  // Tyre tiles
  y = sectionHeading(doc, 'Tyre & Alloy Condition', y);
  const tcW = (CW - 9) / 4;
  const tcH = 20;

  TYRE_POSITIONS.forEach(({ key, label }, i) => {
    const val  = report.tire_conditions[key as keyof typeof report.tire_conditions];
    const cond = TYRE_CONDITIONS.find(c => c.value === val);
    const col  = TYRE_COND_COLORS[val ?? ''] ?? C.muted;
    const bg   = TYRE_COND_BG[val ?? ''] ?? C.bg;
    const bdr  = TYRE_COND_BDR[val ?? ''] ?? C.border;
    const tx   = M + i * (tcW + 3);

    ff(doc, C.bgDeep); rr(doc, tx + 0.5, y + 0.5, tcW, tcH, 2, 'F');
    ff(doc, bg); df(doc, bdr); doc.setLineWidth(0.5);
    rr(doc, tx, y, tcW, tcH, 2, 'FD');
    ff(doc, col); rr(doc, tx, y, tcW, 4, 2, 'F');
    doc.rect(tx, y + 2, tcW, 2, 'F');

    const cx = tx + tcW / 2, cy = y + 11;
    ff(doc, col); doc.circle(cx, cy, 3.8, 'F');
    ff(doc, bg); doc.circle(cx, cy, 2.6, 'F');
    ff(doc, col); doc.circle(cx, cy, 1.2, 'F');
    ff(doc, bg); doc.circle(cx, cy, 0.5, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2); tf(doc, C.muted);
    doc.text(label, cx, y + 16.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); tf(doc, col);
    const condLabel = cond?.label ?? 'Not set';
    let cl = condLabel;
    while (doc.getTextWidth(cl) > tcW - 3 && cl.length > 4) cl = cl.slice(0, -4) + '...';
    doc.text(cl, cx, y + tcH - 1, { align: 'center' });
  });
  y += tcH + 10;  // condition label sits at y+19 (tcH-1); +10 gives a clean 4mm gap to next section heading

  // Damage table
  const dmgCount = report.damages.length;
  const dmgTitle = dmgCount === 0
    ? 'Damage Inspection'
    : `Damage Inspection  -  ${dmgCount} Item${dmgCount !== 1 ? 's' : ''}`;
  y = sectionHeading(doc, dmgTitle, y);

  if (dmgCount === 0) {
    ff(doc, C.successBg); df(doc, C.successBdr); doc.setLineWidth(0.3);
    rr(doc, M, y, CW, 12, 2, 'FD');
    ff(doc, C.success); doc.circle(M + 7, y + 6, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); tf(doc, C.white);
    doc.text('[OK]', M + 7, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); tf(doc, C.success);
    doc.text('No damage recorded during this inspection', M + 14, y + 7.5);
    y += 18;
  } else {
    const tHdr = 7.5;
    const tRow = 6.5;
    const cols = [
      { label: '#',     x: M + 2    },
      { label: 'Part',  x: M + 10   },
      { label: 'Type',  x: M + 64   },
      { label: 'Sev.',  x: M + 94   },
      { label: 'View',  x: M + 120  },
      { label: 'Photo', x: M + 151  },
    ];

    ff(doc, C.navy); rr(doc, M, y, CW, tHdr, 2, 'F');
    doc.rect(M, y + 2, CW, tHdr - 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
    cols.forEach(c => doc.text(c.label, c.x, y + tHdr - 1.5));
    y += tHdr;

    report.damages.forEach((d, i) => {
      const ry = y + i * tRow;
      if (i % 2 === 0) { ff(doc, C.bg); doc.rect(M, ry, CW, tRow, 'F'); }

      const sevColor = d.severity === 'major' ? C.error : C.warning;
      ff(doc, sevColor); doc.circle(cols[0].x + 1.5, ry + tRow / 2, 2.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); tf(doc, C.white);
      doc.text(String(i + 1), cols[0].x + 1.5, ry + tRow / 2 + 1.7, { align: 'center' });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); tf(doc, C.text);
      doc.text(d.part, cols[1].x, ry + 4.5);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); tf(doc, C.textMid);
      const typeCap = d.damage_type.charAt(0).toUpperCase() + d.damage_type.slice(1);
      doc.text(typeCap, cols[2].x, ry + 4.5);

      const sevTxt = d.severity === 'major' ? 'Major' : 'Minor';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8);
      const sevW = doc.getTextWidth(sevTxt) + 6;
      ff(doc, d.severity === 'major' ? C.errorBg : C.warningBg);
      df(doc, sevColor); doc.setLineWidth(0.3);
      rr(doc, cols[3].x, ry + 1.2, sevW, 4.5, 2, 'FD');
      tf(doc, sevColor);
      doc.text(sevTxt, cols[3].x + sevW / 2, ry + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.muted);
      doc.text(d.view ? (VIEW_LABELS[d.view] ?? d.view) : '-', cols[4].x, ry + 4.5);

      if (d.photo_url) {
        ff(doc, C.successBg); df(doc, C.successBdr); doc.setLineWidth(0.25);
        rr(doc, cols[5].x, ry + 1.2, 9, 4.5, 2, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.success);
        doc.text('[Y]', cols[5].x + 4.5, ry + 4.5, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); tf(doc, C.mutedLt);
        doc.text('-', cols[5].x, ry + 4.5);
      }
    });

    df(doc, C.border); doc.setLineWidth(0.25);
    doc.rect(M, y - tHdr, CW, tHdr + dmgCount * tRow, 'S');
    y += dmgCount * tRow + 7;
  }

  // PAGE 2
  if (!hasPage2) { doc.save(`RT-Inspection-${job.id}.pdf`); return; }

  doc.addPage();
  pageHeader(doc, 2, totalPages);
  pageFooter(doc, job.id, generated);
  y = BODY_Y + 1;

  // Vehicle angle photos
  if (angleEntries.length > 0) {
    y = sectionHeading(doc, 'Vehicle Photos - Captured by Inspector', y);
    const aw = (CW - 5) / 2;
    const ah = 32;
    let photoCol = 0;
    for (const [key, url] of angleEntries) {
      imageCard(doc, url, VIEW_LABELS[key] ?? key, M + photoCol * (aw + 5), y, aw, ah);
      photoCol++;
      if (photoCol >= 2) { photoCol = 0; y += ah + CAPTION_H + 7; }  // card height = ah+captionH; +7 gap
    }
    if (photoCol > 0) y += ah + CAPTION_H + 7;
    y += 4;
  }

  // Damage photos
  if (dmgPhotos.length > 0) {
    y = sectionHeading(doc, 'Damage Photos', y);
    const dw = (CW - 10) / 3;
    const dh = 22;
    let dmgCol = 0;
    for (const d of dmgPhotos) {
      const lb = `${d.part} - ${d.severity === 'major' ? 'Major' : 'Minor'}`;
      imageCard(doc, d.photo_url, lb, M + dmgCol * (dw + 5), y, dw, dh);
      dmgCol++;
      if (dmgCol >= 3) { dmgCol = 0; y += dh + CAPTION_H + 7; }  // card height = dh+captionH; +7 gap
    }
    if (dmgCol > 0) y += dh + CAPTION_H + 7;
    const totalDmg = report.damages.filter(d => !!d.photo_url).length;
    if (totalDmg > 6) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(6); tf(doc, C.muted);
      doc.text(`+ ${totalDmg - 6} more damage photo${totalDmg - 6 > 1 ? 's' : ''} available in the system`, M, y);
      y += 8;
    }
    y += 4;
  }

  // Signatures — start a new page if not enough room (heading + two sig cards + disclaimer)
  const sigImgH  = 26;
  const sigCardH = sigImgH + 30;  // header bar(9) + avatar row(13) + signed row(8) + sig image(sigImgH)
  const sigBlockNeeded = 8 + sigCardH + 5 + 18;  // section heading + cards + gap + disclaimer
  if (y + sigBlockNeeded > PH - 12) {
    doc.addPage();
    pageHeader(doc, 3, totalPages);
    pageFooter(doc, job.id, generated);
    y = BODY_Y + 1;
  }
  y = sectionHeading(doc, 'Signatures', y);
  const sw = (CW - 5) / 2;

  const drawSigBox = (
    bx: number, by: number,
    title: string,
    name: string | undefined,
    signedAt: string | undefined,
    sigUrl: string | undefined,
  ) => {
    ff(doc, C.bgDeep); rr(doc, bx + 0.7, by + 0.7, sw, sigCardH, 3, 'F');
    ff(doc, C.bgCard); df(doc, C.border); doc.setLineWidth(0.25);
    rr(doc, bx, by, sw, sigCardH, 3, 'FD');
    ff(doc, C.navy); rr(doc, bx, by, sw, 9, 3, 'F');
    doc.rect(bx, by + 4, sw, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); tf(doc, C.white);
    doc.text(title, bx + sw / 2, by + 6.5, { align: 'center' });

    let sy = by + 14;
    const initials = (name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    ff(doc, C.navyLight); doc.circle(bx + 7, sy - 1, 4.5, 'F');
    ff(doc, C.bgAlt); doc.circle(bx + 7, sy - 1, 3.2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); tf(doc, C.navyLight);
    doc.text(initials, bx + 7, sy + 1, { align: 'center' });

    if (name) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); tf(doc, C.text);
      doc.text(name, bx + 14, sy + 0.5);
    }
    sy += 7;

    if (signedAt) {
      ff(doc, C.bgAlt); df(doc, C.border); doc.setLineWidth(0.15);
      rr(doc, bx + 3, sy - 3, sw - 6, 6, 1.5, 'FD');
      ff(doc, C.navyLight); doc.circle(bx + 6.5, sy, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); tf(doc, C.white);
      doc.text('T', bx + 6.5, sy + 1.3, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); tf(doc, C.muted);
      doc.text('Signed:', bx + 10, sy + 1);
      doc.setFont('helvetica', 'bold'); tf(doc, C.text);
      doc.text(fmtSigned(signedAt), bx + 21, sy + 1);
      sy += 7;
    } else {
      sy += 2;
    }

    ff(doc, C.bg); df(doc, C.borderMid); doc.setLineWidth(0.2);
    rr(doc, bx + 3, sy, sw - 6, sigImgH, 2, 'FD');
    if (!placeImage(doc, sigUrl, bx + 3, sy, sw - 6, sigImgH)) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(6); tf(doc, C.mutedLt);
      doc.text('No signature captured', bx + sw / 2, sy + sigImgH / 2, { align: 'center' });
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
  y += sigCardH + 5;

  // Disclaimer bar
  ff(doc, C.bgAlt); df(doc, C.border); doc.setLineWidth(0.2);
  rr(doc, M, y, CW, 9, 2, 'FD');
  ff(doc, C.accent); rr(doc, M, y, 3, 9, 2, 'F');
  doc.rect(M + 1, y, 2, 9, 'F');
  doc.setFont('helvetica', 'italic'); doc.setFontSize(5.8); tf(doc, C.muted);
  doc.text(
    'This is an official pre-service inspection record. Any alteration invalidates this document. Royal Tyres Inspection System.',
    M + 6, y + 5.5,
  );

  doc.save(`RT-Inspection-${job.id}.pdf`);
}