import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const TEMPLATE = fileURLToPath(new URL('../../assets/certificate-template.pdf', import.meta.url));
const STAMP = fileURLToPath(new URL('../../assets/trackmaster-stamp.png', import.meta.url));
const LOGO_MARK = fileURLToPath(new URL('../../assets/trackmaster-mark.png', import.meta.url));

const WHITE = rgb(1, 1, 1);
const INK = rgb(0.11, 0.13, 0.19);
const RED = rgb(0.84, 0.16, 0.18);
const PAGE_HEIGHT = 841.92;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const display = (value) => String(value || '—').trim() || '—';

function cover(page, x, top, width, height) {
  page.drawRectangle({ x, y: PAGE_HEIGHT - top - height, width, height, color: WHITE });
}

function drawTextTop(page, font, text, x, top, width, { size = 9, color = INK, align = 'left' } = {}) {
  let fontSize = size;
  while (font.widthOfTextAtSize(text, fontSize) > width && fontSize > 5.5) fontSize -= 0.25;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const drawX = align === 'right' ? x + width - textWidth : align === 'center' ? x + (width - textWidth) / 2 : x;
  page.drawText(text, { x: drawX, y: PAGE_HEIGHT - top - fontSize, size: fontSize, font, color });
}

/** Renders the stored certificate data onto the supplied Track Master template. */
export async function renderCertificatePdf(cert) {
  const [templateBytes, stampBytes, logoBytes] = await Promise.all([readFile(TEMPLATE), readFile(STAMP), readFile(LOGO_MARK)]);
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPage(0);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const stamp = await pdf.embedPng(stampBytes);
  const logo = await pdf.embedPng(logoBytes);

  page.drawImage(logo, {
    x: 203,
    y: PAGE_HEIGHT - 520,
    width: 190,
    height: 190,
    opacity: 0.07,
  });

  const fields = [
    [505, 44, 58, 18, cert.number, 10, RED],
    [62, 340, 125, 22, display(cert.vehicle.registration), 13, INK],
    [225, 340, 125, 22, display(cert.vehicle.makeModel), 9, INK],
    [390, 340, 125, 22, display(cert.vehicle.colour), 9, INK],
    [62, 389, 125, 22, display(cert.vehicle.engineNo), 9, INK],
    [225, 389, 125, 22, display(cert.vehicle.chassisNo), 9, INK],
    [390, 389, 125, 22, display(cert.vehicle.deviceImei), 8, INK],
    [62, 437, 125, 22, formatDate(cert.installedAt), 9, INK],
    [225, 437, 125, 22, formatDate(cert.expiresAt), 9, INK],
    [160, 533, 370, 20, display(cert.customer.name).toUpperCase(), 8, INK],
    [160, 561, 370, 20, cert.showCnic ? display(cert.customer.cnic) : '—', 8, INK],
    [160, 589, 370, 20, display(cert.customer.phone), 8, INK],
    [160, 617, 370, 24, display(cert.customer.address), 7.5, INK],
  ];

  for (const [x, top, width, height, text, size, color] of fields) {
    cover(page, x - 2, top - 2, width + 4, height);
    drawTextTop(page, bold, text, x, top, width, { size, color });
  }

  // Replace the template's sample signature block with one supplied stamp.
  cover(page, 330, 640, 210, 130);
  page.drawImage(stamp, { x: 378, y: PAGE_HEIGHT - 745, width: 80, height: 80 });

  if (cert.status !== 'active') {
    const text = cert.status === 'cancelled' ? 'CANCELLED' : 'REPLACED';
    page.drawText(text, {
      x: 125,
      y: 380,
      size: 58,
      font: bold,
      color: RED,
      opacity: 0.18,
      rotate: degrees(32),
    });
  }

  pdf.setTitle(`Tracker Certificate ${cert.number}`);
  pdf.setSubject(`Vehicle ${display(cert.vehicle.registration)}`);
  return Buffer.from(await pdf.save());
}
