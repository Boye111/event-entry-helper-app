"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type Props = { onDecode: (text: string) => void; paused: boolean };

export function CameraView({ onDecode, paused }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodeRef = useRef(onDecode);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  onDecodeRef.current = onDecode;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let instance: Html5Qrcode | null = null;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.75);
              return { width: size, height: size };
            },
          },
          (text) => {
            if (!pausedRef.current) onDecodeRef.current(text);
          },
          () => {},
        );
        if (cancelled) await instance.stop().catch(() => {});
      } catch (e) {
        if (cancelled) return;
        const msg = String(e instanceof Error ? e.message : e);
        setError(
          /permission|notallowed/i.test(msg)
            ? "Camera permission was blocked. Tap the lock icon in the address bar → allow Camera, then reload."
            : /secure|https/i.test(msg)
              ? "The camera needs HTTPS. Open the live site link (https://…)."
              : "Couldn't start the camera. Reload the page, or use Search.",
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s?.isScanning) void s.stop().then(() => s.clear()).catch(() => {});
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div id="qr-reader" className="absolute inset-0" />
      {starting && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70">Starting camera…</div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-lg">{error}</div>
      )}
      {!error && !starting && (
        <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80 drop-shadow">
          Point at the guest&apos;s QR code
        </p>
      )}
    </div>
  );
}
