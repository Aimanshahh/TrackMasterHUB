import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

import { certificateBusiness as biz } from '../../config/business.js';

const LOGO = fileURLToPath(new URL('../../assets/trackmaster-logo.png', import.meta.url));

const INK = '#1d2230';
const MUTED = '#667085';
const RULE = '#e3e6ec';
const ACCENT = '#d7282f';
const PANEL = '#f6f7f9';

const W = 595.28; // A4 in points
const H = 841.89;
const M = 48;
const CONTENT = W - M * 2;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

function label(doc, text, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(text.toUpperCase(), x, y, { width, characterSpacing: 0.8 });
}

function value(doc, text, x, y, width, { size = 11.5, bold = true } = {}) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(INK).text(text || '—', x, y, { width });
}

/** Renders a certificate to a PDF buffer. Pure: takes the stored certificate JSON, touches nothing else. */
export function renderCertificatePdf(cert) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: { Title: `Tracker Certificate ${cert.number}`, Author: biz.legalName, Subject: `Vehicle ${cert.vehicle.registration}` },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Top accent band
    doc.rect(0, 0, W, 9).fill(ACCENT);

    // Header: logo + company, certificate number block
    doc.image(LOGO, M, 34, { width: 58 });
    doc.font('Helvetica-Bold').fontSize(19).fillColor(INK).text(biz.legalName, M + 72, 44, { width: 280 });
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(biz.tagline, M + 72, 68, { width: 280 });

    const boxW = 168;
    const boxX = W - M - boxW;
    doc.roundedRect(boxX, 34, boxW, 62, 6).fill(PANEL);
    label(doc, 'Certificate no.', boxX + 14, 44, boxW - 28);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(ACCENT).text(cert.number, boxX + 14, 56, { width: boxW - 28 });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`Issued ${formatDate(cert.issuedAt)}`, boxX + 14, 80, { width: boxW - 28 });

    // Title
    doc.font('Helvetica-Bold').fontSize(24).fillColor(INK).text('Vehicle Tracker Certificate', M, 130, { width: CONTENT, align: 'center' });
    doc.rect(W / 2 - 28, 164, 56, 3).fill(ACCENT);

    doc.font('Helvetica').fontSize(10.5).fillColor('#3b4252').text(
      `${biz.legalName} confirms that a GPS vehicle tracking device was installed in the vehicle described below. This certificate records the installation and its period of validity.`,
      M + 20, 186, { width: CONTENT - 40, align: 'center', lineGap: 3 },
    );

    // Vehicle card
    const top = 246;
    const cardH = 132;
    doc.roundedRect(M, top, CONTENT, cardH, 8).lineWidth(1).strokeColor(RULE).stroke();
    doc.rect(M, top, 5, cardH).fill(ACCENT);

    const colW = (CONTENT - 40) / 3;
    const cx = (i) => M + 24 + i * colW;
    label(doc, 'Registration no.', cx(0), top + 16, colW);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(cert.vehicle.registration || '—', cx(0), top + 30, { width: colW * 2 - 10 });
    label(doc, 'Make / model', cx(2), top + 16, colW);
    value(doc, cert.vehicle.makeModel, cx(2), top + 30, colW - 8, { size: 12 });

    doc.moveTo(M + 24, top + 66).lineTo(W - M - 16, top + 66).lineWidth(0.6).strokeColor(RULE).stroke();

    label(doc, 'Engine no.', cx(0), top + 80, colW);
    value(doc, cert.vehicle.engineNo, cx(0), top + 93, colW - 8);
    label(doc, 'Chassis no.', cx(1), top + 80, colW);
    value(doc, cert.vehicle.chassisNo, cx(1), top + 93, colW - 8);
    label(doc, 'Colour', cx(2), top + 80, colW);
    value(doc, cert.vehicle.colour, cx(2), top + 93, colW - 8);

    // Validity
    const vTop = top + cardH + 20;
    const half = (CONTENT - 14) / 2;
    doc.roundedRect(M, vTop, half, 64, 8).fill(PANEL);
    label(doc, 'Date of installation', M + 18, vTop + 14, half - 30);
    doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text(formatDate(cert.installedAt), M + 18, vTop + 30, { width: half - 30 });
    doc.roundedRect(M + half + 14, vTop, half, 64, 8).fill(PANEL);
    label(doc, 'Valid until', M + half + 32, vTop + 14, half - 30);
    doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text(formatDate(cert.expiresAt), M + half + 32, vTop + 30, { width: half - 30 });

    // Client details
    const cTop = vTop + 64 + 22;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT).text('CLIENT DETAILS', M, cTop, { characterSpacing: 1 });
    doc.moveTo(M, cTop + 15).lineTo(W - M, cTop + 15).lineWidth(0.6).strokeColor(RULE).stroke();

    const rows = [['Name', cert.customer.name], ['Mobile', cert.customer.phone]];
    if (cert.showCnic && cert.customer.cnic) rows.push(['CNIC', cert.customer.cnic]);
    rows.push(['Address', cert.customer.address]);

    let y = cTop + 26;
    for (const [name, text] of rows) {
      label(doc, name, M, y + 2, 80);
      const h = doc.font('Helvetica-Bold').fontSize(11).heightOfString(text || '—', { width: CONTENT - 96 });
      value(doc, text, M + 96, y, CONTENT - 96, { size: 11 });
      y += Math.max(20, h + 9);
    }

    if (cert.vehicle.deviceImei) {
      label(doc, 'Tracker IMEI', M, y + 2, 80);
      value(doc, cert.vehicle.deviceImei, M + 96, y, CONTENT - 96, { size: 11 });
      y += 22;
    }

    if (cert.reissueOf) {
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED).text(
        `This certificate replaces an earlier certificate for the same vehicle${cert.reissueReason ? `: ${cert.reissueReason}` : '.'}`,
        M, y + 6, { width: CONTENT },
      );
    }

    // Signature
    const sY = Math.min(Math.max(y + 54, 660), 690);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Thank you for choosing us.', M, sY + 8, { width: 220 });
    doc.moveTo(W - M - 170, sY + 22).lineTo(W - M, sY + 22).lineWidth(0.8).strokeColor(INK).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('Authorised signatory', W - M - 170, sY + 28, { width: 170, align: 'center' });

    // Footer band
    const fTop = H - 78;
    doc.rect(0, fTop, W, 78).fill(INK);
    doc.rect(0, fTop, W, 3).fill(ACCENT);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(biz.email, M, fTop + 18, { width: 200 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#c9ced8').text(biz.website, M, fTop + 32, { width: 200 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#ffffff').text(biz.phones.join('   '), M, fTop + 18, { width: CONTENT, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#c9ced8').text(biz.address, W - M - 300, fTop + 34, { width: 300, align: 'right' });

    // Status stamp for certificates that are no longer valid
    if (cert.status !== 'active') {
      const text = cert.status === 'cancelled' ? 'CANCELLED' : 'REPLACED';
      doc.save();
      doc.opacity(0.16);
      doc.rotate(-32, { origin: [W / 2, H / 2] });
      doc.font('Helvetica-Bold').fontSize(96).fillColor(ACCENT).text(text, 0, H / 2 - 50, { width: W, align: 'center' });
      doc.restore();
    }

    doc.end();
  });
}
