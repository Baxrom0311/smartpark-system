/**
 * PDF report export for the therapist analysis page.
 *
 * Built on pdf-lib (1.17.1) — a pure-JS, DOM-free PDF generator. This
 * keeps the export functional in jsdom for tests and works in every
 * supported browser without canvas / native dependencies.
 *
 * The report layout is intentionally simple — title, overall result,
 * and a section per recording with risk/confidence, transcript, and
 * compact summaries of each acoustic feature group. Charts are *not*
 * embedded as images (that would require canvas-based rasterization,
 * which jsdom does not implement); instead we surface the underlying
 * numeric summaries so the report carries the same clinical
 * information shown on screen.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import type {
  AnalysisDetailed,
  AssessmentDetailedAnalysisResponse,
  RiskLevel,
} from "@/types";

const PAGE_WIDTH = 595.28; // A4 width in pts.
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_GAP = 4;
const PARA_GAP = 8;
const SECTION_GAP = 14;

const COLOR_TEXT: RGB = rgb(0.13, 0.16, 0.2);
const COLOR_MUTED: RGB = rgb(0.45, 0.5, 0.58);
const COLOR_RULE: RGB = rgb(0.85, 0.87, 0.9);

const RISK_COLORS: Record<RiskLevel, RGB> = {
  green: rgb(0.13, 0.55, 0.32),
  yellow: rgb(0.78, 0.55, 0.05),
  red: rgb(0.74, 0.16, 0.16),
};

/**
 * i18n strings the caller injects so the PDF respects the active
 * language. Keep field names stable — the test asserts on the keys
 * being rendered as-is.
 */
export interface PdfReportLabels {
  reportTitle: string;
  generatedAt: string;
  assessmentId: string;
  overallRisk: string;
  overallConfidence: string;
  status: string;
  completedAt: string;
  noOverallRisk: string;
  recording: string;
  recordingId: string;
  riskLevel: string;
  confidence: string;
  transcript: string;
  noTranscript: string;
  features: string;
  pitch: string;
  pitchSummary: string;
  formants: string;
  formantsSummary: string;
  mfcc: string;
  mfccSummary: string;
  phonemes: string;
  weakest: string;
  strongest: string;
  noFeature: string;
  empty: string;
  riskGreen: string;
  riskYellow: string;
  riskRed: string;
}

export interface PdfReportInput {
  data: AssessmentDetailedAnalysisResponse;
  labels: PdfReportLabels;
  /** ISO timestamp; defaults to `new Date().toISOString()`. */
  generatedAtIso?: string;
}

/**
 * Build the analysis PDF and return raw bytes. The bytes can be
 * converted to a Blob by the caller for a download trigger.
 */
export async function buildAnalysisPdf(
  input: PdfReportInput,
): Promise<Uint8Array> {
  const { data, labels, generatedAtIso } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(labels.reportTitle);
  doc.setProducer("sado-admin");
  doc.setCreator("sado-admin");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: RenderCtx = {
    doc,
    font,
    bold,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    cursorY: PAGE_HEIGHT - MARGIN,
  };

  drawHeader(ctx, labels, generatedAtIso ?? new Date().toISOString());
  drawOverall(ctx, labels, data);

  if (data.results.length === 0) {
    drawWrappedText(ctx, labels.empty, font, 11, COLOR_MUTED);
  } else {
    data.results.forEach((result, idx) => {
      drawRecording(ctx, labels, result, idx + 1);
    });
  }

  return doc.save();
}

interface RenderCtx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  cursorY: number;
}

function ensureSpace(ctx: RenderCtx, needed: number): void {
  if (ctx.cursorY - needed >= MARGIN) return;
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.cursorY = PAGE_HEIGHT - MARGIN;
}

function drawHeader(
  ctx: RenderCtx,
  labels: PdfReportLabels,
  generatedAtIso: string,
): void {
  ensureSpace(ctx, 60);
  ctx.cursorY -= 18;
  ctx.page.drawText(labels.reportTitle, {
    x: MARGIN,
    y: ctx.cursorY,
    size: 22,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.cursorY -= 22;
  ctx.page.drawText(`${labels.generatedAt}: ${formatDate(generatedAtIso)}`, {
    x: MARGIN,
    y: ctx.cursorY,
    size: 10,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.cursorY -= 14;
  drawRule(ctx);
  ctx.cursorY -= SECTION_GAP;
}

function drawOverall(
  ctx: RenderCtx,
  labels: PdfReportLabels,
  data: AssessmentDetailedAnalysisResponse,
): void {
  ensureSpace(ctx, 96);
  drawHeading(ctx, labels.overallRisk, 14);
  const overall = data.overall_risk;
  const riskColor = overall ? RISK_COLORS[overall] : COLOR_MUTED;
  const riskText = overall
    ? riskLabel(overall, labels)
    : labels.noOverallRisk;

  drawKv(ctx, labels.assessmentId, data.assessment_id);
  drawKv(ctx, labels.overallRisk, riskText, riskColor);
  drawKv(
    ctx,
    labels.overallConfidence,
    formatPct(data.overall_confidence),
  );
  drawKv(ctx, labels.status, data.status);
  drawKv(ctx, labels.completedAt, formatDate(data.completed_at));
  ctx.cursorY -= SECTION_GAP;
  drawRule(ctx);
  ctx.cursorY -= SECTION_GAP;
}

function drawRecording(
  ctx: RenderCtx,
  labels: PdfReportLabels,
  result: AnalysisDetailed,
  index: number,
): void {
  ensureSpace(ctx, 140);
  drawHeading(ctx, `${labels.recording} #${index}`, 13);

  drawKv(ctx, labels.recordingId, result.recording_id);
  drawKv(
    ctx,
    labels.riskLevel,
    riskLabel(result.risk_level, labels),
    RISK_COLORS[result.risk_level],
  );
  drawKv(ctx, labels.confidence, formatPct(result.confidence));

  ctx.cursorY -= LINE_GAP;
  drawSubheading(ctx, labels.transcript);
  if (result.transcript && result.transcript.trim().length > 0) {
    drawWrappedText(ctx, result.transcript, ctx.font, 10.5, COLOR_TEXT);
  } else {
    drawWrappedText(ctx, labels.noTranscript, ctx.font, 10.5, COLOR_MUTED);
  }

  ctx.cursorY -= LINE_GAP;
  drawSubheading(ctx, labels.features);

  // Pitch summary.
  if (result.pitch_data) {
    const { f0_mean, f0_min, f0_max, voiced_ratio } = result.pitch_data;
    drawWrappedText(
      ctx,
      `${labels.pitch}: ${labels.pitchSummary
        .replace("{mean}", f0_mean.toFixed(1))
        .replace("{min}", f0_min.toFixed(1))
        .replace("{max}", f0_max.toFixed(1))
        .replace("{voiced}", (voiced_ratio * 100).toFixed(0))}`,
      ctx.font,
      10,
      COLOR_TEXT,
    );
  } else {
    drawWrappedText(
      ctx,
      `${labels.pitch}: ${labels.noFeature}`,
      ctx.font,
      10,
      COLOR_MUTED,
    );
  }

  // Formant summary.
  if (result.formant_data) {
    const { f1_mean, f2_mean, f3_mean } = result.formant_data;
    drawWrappedText(
      ctx,
      `${labels.formants}: ${labels.formantsSummary
        .replace("{f1}", f1_mean.toFixed(0))
        .replace("{f2}", f2_mean.toFixed(0))
        .replace("{f3}", f3_mean.toFixed(0))}`,
      ctx.font,
      10,
      COLOR_TEXT,
    );
  } else {
    drawWrappedText(
      ctx,
      `${labels.formants}: ${labels.noFeature}`,
      ctx.font,
      10,
      COLOR_MUTED,
    );
  }

  // MFCC summary.
  if (result.mfcc_features) {
    const m = result.mfcc_features;
    drawWrappedText(
      ctx,
      `${labels.mfcc}: ${labels.mfccSummary
        .replace("{n}", String(m.n_mfcc))
        .replace("{frames}", String(m.n_frames))
        .replace("{min}", m.min.toFixed(2))
        .replace("{max}", m.max.toFixed(2))}`,
      ctx.font,
      10,
      COLOR_TEXT,
    );
  } else {
    drawWrappedText(
      ctx,
      `${labels.mfcc}: ${labels.noFeature}`,
      ctx.font,
      10,
      COLOR_MUTED,
    );
  }

  // Phoneme summary.
  if (result.phoneme_scores) {
    const ph = result.phoneme_scores;
    const weakest = ph.weakest
      .slice(0, 3)
      .map((w) => `${w.phoneme} ${(w.score * 100).toFixed(0)}%`)
      .join(", ");
    const strongest = ph.strongest
      .slice(0, 3)
      .map((w) => `${w.phoneme} ${(w.score * 100).toFixed(0)}%`)
      .join(", ");
    drawWrappedText(
      ctx,
      `${labels.phonemes}: ${labels.weakest}: ${weakest || "—"} · ${labels.strongest}: ${strongest || "—"}`,
      ctx.font,
      10,
      COLOR_TEXT,
    );
  } else {
    drawWrappedText(
      ctx,
      `${labels.phonemes}: ${labels.noFeature}`,
      ctx.font,
      10,
      COLOR_MUTED,
    );
  }

  ctx.cursorY -= SECTION_GAP;
  drawRule(ctx);
  ctx.cursorY -= SECTION_GAP;
}

function drawHeading(ctx: RenderCtx, text: string, size: number): void {
  ensureSpace(ctx, size + LINE_GAP * 2);
  ctx.cursorY -= size;
  ctx.page.drawText(text, {
    x: MARGIN,
    y: ctx.cursorY,
    size,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.cursorY -= LINE_GAP * 2;
}

function drawSubheading(ctx: RenderCtx, text: string): void {
  ensureSpace(ctx, 14);
  ctx.cursorY -= 12;
  ctx.page.drawText(text, {
    x: MARGIN,
    y: ctx.cursorY,
    size: 11,
    font: ctx.bold,
    color: COLOR_TEXT,
  });
  ctx.cursorY -= LINE_GAP * 2;
}

function drawKv(
  ctx: RenderCtx,
  label: string,
  value: string,
  valueColor: RGB = COLOR_TEXT,
): void {
  ensureSpace(ctx, 14);
  ctx.cursorY -= 12;
  ctx.page.drawText(`${label}:`, {
    x: MARGIN,
    y: ctx.cursorY,
    size: 10,
    font: ctx.bold,
    color: COLOR_MUTED,
  });
  const labelWidth = ctx.bold.widthOfTextAtSize(`${label}:`, 10);
  ctx.page.drawText(value, {
    x: MARGIN + labelWidth + 6,
    y: ctx.cursorY,
    size: 10,
    font: ctx.font,
    color: valueColor,
  });
  ctx.cursorY -= LINE_GAP;
}

function drawRule(ctx: RenderCtx): void {
  ensureSpace(ctx, 4);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY },
    end: { x: MARGIN + CONTENT_WIDTH, y: ctx.cursorY },
    thickness: 0.5,
    color: COLOR_RULE,
  });
}

/**
 * Render text wrapped to CONTENT_WIDTH at the given size. Sanitises any
 * code points that fall outside Helvetica's WinAnsi coverage so pdf-lib
 * cannot throw on Cyrillic / Latin-extended characters appearing in
 * Uzbek or Russian transcripts. Out-of-range characters are replaced
 * with `?` — the report stays legible for ASCII content (transcripts,
 * IDs, percentages) which is the bulk of the data.
 */
function drawWrappedText(
  ctx: RenderCtx,
  text: string,
  font: PDFFont,
  size: number,
  color: RGB,
): void {
  const safe = sanitizeWinAnsi(text);
  const lineHeight = size + LINE_GAP;
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    ensureSpace(ctx, lineHeight);
    ctx.cursorY -= lineHeight;
    return;
  }
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > CONTENT_WIDTH && line) {
      ensureSpace(ctx, lineHeight);
      ctx.cursorY -= lineHeight;
      ctx.page.drawText(line, {
        x: MARGIN,
        y: ctx.cursorY,
        size,
        font,
        color,
      });
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    ensureSpace(ctx, lineHeight);
    ctx.cursorY -= lineHeight;
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.cursorY,
      size,
      font,
      color,
    });
  }
  ctx.cursorY -= PARA_GAP;
}

const WINANSI_RANGE = /[^\u0000-\u00FF]/g;

function sanitizeWinAnsi(text: string): string {
  return text.replace(WINANSI_RANGE, "?");
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return iso;
  }
}

function riskLabel(level: RiskLevel, labels: PdfReportLabels): string {
  switch (level) {
    case "green":
      return labels.riskGreen;
    case "yellow":
      return labels.riskYellow;
    case "red":
      return labels.riskRed;
  }
}

/**
 * Trigger a download of the produced PDF. Pulled out of the React
 * component so it can be unit-tested in isolation. Falls back silently
 * when the document object is unavailable (e.g. server-side render).
 */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  if (typeof document === "undefined") return;
  // Copy into a fresh ArrayBuffer so the Blob is decoupled from the
  // pdf-lib output buffer (some jsdom builds reject SharedArrayBuffer
  // views otherwise).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
