import "server-only";
import QRCode from "qrcode";

/**
 * QR payloads are the stone's own URL, so any phone camera opens the record —
 * no app to install and nothing to teach. That matters more than compactness
 * on a packet label somebody will scan while holding tweezers.
 */
export async function stoneQrSvg(url: string, size = 96): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 0,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
