import "server-only";
import QRCode from "qrcode";
import { inviteUrl } from "./site";

const opts = { errorCorrectionLevel: "Q" as const, margin: 2, color: { dark: "#1f2937", light: "#ffffff" } };

export function qrPng(code: string, width = 600): Promise<Buffer> {
  return QRCode.toBuffer(inviteUrl(code), { ...opts, width, type: "png" });
}

export function qrDataUrl(code: string, width = 600): Promise<string> {
  return QRCode.toDataURL(inviteUrl(code), { ...opts, width });
}
