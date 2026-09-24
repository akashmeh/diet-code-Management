import JSZip from "jszip";
import QRCode from "qrcode";
import { qrPayload, type Team } from "@/lib/dietcode";
import { triggerDownload } from "@/lib/spreadsheet";

export async function qrDataUrl(token: string, size = 420) {
  return QRCode.toDataURL(qrPayload(token), {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Printable monochrome QR card as an SVG string (crisp for print). */
export async function qrCardSvg(team: Team) {
  const dataUrl = await qrDataUrl(team.qr_token, 600);
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#ffffff"/>
  <rect x="16" y="16" width="568" height="768" fill="none" stroke="#000000" stroke-width="2"/>
  <text x="300" y="92" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="42" letter-spacing="6" fill="#000000">DIET CODE</text>
  <line x1="60" y1="120" x2="540" y2="120" stroke="#000000" stroke-width="1"/>
  <text x="300" y="168" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="24" letter-spacing="3" fill="#555555">${escape(team.team_id)}</text>
  <text x="300" y="218" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="32" font-weight="600" fill="#000000">${escape(team.team_name.slice(0, 28))}</text>
  <image x="120" y="255" width="360" height="360" href="${dataUrl}"/>
  <text x="300" y="672" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="20" fill="#555555">Scan to verify</text>
  <text x="300" y="730" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" letter-spacing="2" fill="#888888">SKETCH · SRM RAMAPURAM</text>
</svg>`;
}

export async function downloadTeamQr(team: Team) {
  const svg = await qrCardSvg(team);
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${team.team_id}-qr-card.svg`);
}

export async function downloadTeamQrPng(team: Team) {
  const dataUrl = await qrDataUrl(team.qr_token, 800);
  const response = await fetch(dataUrl);
  triggerDownload(await response.blob(), `${team.team_id}-qr.png`);
}

export async function downloadAllQrZip(teams: Team[], onProgress?: (done: number) => void) {
  const zip = new JSZip();
  const folder = zip.folder("diet-code-qr-cards")!;
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index]!;
    const safeName = `${team.team_id}-${team.team_name}`.replace(/[^a-zA-Z0-9-_]+/g, "_");
    folder.file(`${safeName}.svg`, await qrCardSvg(team));
    onProgress?.(index + 1);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "diet-code-qr-cards.zip");
}

export async function printQrCard(team: Team) {
  const svg = await qrCardSvg(team);
  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${team.team_id} · DIET CODE</title><style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center}svg{width:100%;max-width:520px;height:auto}</style></head><body>${svg}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
