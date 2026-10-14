import QRCode from "qrcode";

// Low error correction = fewer, larger modules, which scan more reliably off a screen.
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "L", margin: 4 });
}
