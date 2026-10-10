"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isNativeApp, tapFeedback } from "@/lib/native/platform";

type Detected = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<Detected[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

function nativeDetector(): DetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
}

const isProductCode = (value: string) => /^\d{8,14}$/.test(value);

/**
 * Live barcode scanning. Frames stay on the device: only the decoded number
 * is sent to the server.
 *
 * Two engines, chosen at runtime:
 *  - the browser's built-in BarcodeDetector where it exists (Chrome, Edge,
 *    Android), which is fast and costs no extra download;
 *  - otherwise ZXing, a JavaScript decoder loaded only when needed. This is
 *    what makes scanning work in Safari on iPhone and in Firefox.
 */
export function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  // This component is loaded client-side only, so the platform is known on the first render.
  return isNativeApp() ? <NativeScanner onDetected={onDetected} /> : <WebScanner onDetected={onDetected} />;
}

/**
 * Inside the phone app the system's own scanner is used: it opens full
 * screen, focuses faster than a web page can, and has a torch button.
 */
function NativeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [state, setState] = useState<"open" | "closed" | "error">("open");
  const started = useRef(false);

  const scan = useCallback(async () => {
    setState("open");
    try {
      const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import("@capacitor/barcode-scanner");
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.ALL,
        scanInstructions: "Point the camera at the barcode",
        scanButton: false,
      });
      const code = result.ScanResult.trim();
      if (isProductCode(code)) {
        void tapFeedback();
        onDetected(code);
      } else {
        // Closed without a product code (cancelled, or a QR code).
        setState("closed");
      }
    } catch {
      setState("error");
    }
  }, [onDetected]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void scan();
  }, [scan]);

  return (
    <div className="border border-rule-strong p-5">
      <p role="status" className="leading-relaxed text-ink-soft">
        {state === "open"
          ? "Opening the scanner…"
          : state === "closed"
            ? "No barcode was read."
            : "The scanner could not open. Check that Almanac may use the camera in your phone's settings, or type the number below."}
      </p>
      {state !== "open" ? (
        <Button variant="outline" className="mt-3" onClick={() => void scan()}>
          Scan again
        </Button>
      ) : null}
    </div>
  );
}

function WebScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // This component is loaded client-side only, so the browser check can run during the first render.
  const [state, setState] = useState<"starting" | "scanning" | "unsupported" | "denied" | "error">(() =>
    "mediaDevices" in navigator ? "starting" : "unsupported",
  );

  useEffect(() => {
    if (!("mediaDevices" in navigator)) return;
    const video = videoRef.current;
    if (!video) return;

    let stopped = false;
    let stop: () => void = () => undefined;
    const found = (code: string) => {
      if (stopped || !isProductCode(code)) return;
      stopped = true;
      stop();
      navigator.vibrate?.(40);
      onDetected(code);
    };
    const fail = (err: unknown) => {
      if (stopped) return;
      setState(err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError") ? "denied" : "error");
    };
    const constraints: MediaStreamConstraints = { video: { facingMode: { ideal: "environment" } }, audio: false };

    const Native = nativeDetector();
    if (Native) {
      let stream: MediaStream | null = null;
      let timer: ReturnType<typeof setInterval> | null = null;
      stop = () => {
        if (timer) clearInterval(timer);
        stream?.getTracks().forEach((t) => t.stop());
      };
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stopped) return stop();
          video.srcObject = stream;
          await video.play();
          setState("scanning");
          const detector = new Native({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
          // Four reads a second is plenty and keeps the main thread free.
          timer = setInterval(async () => {
            if (video.readyState < 2) return;
            try {
              const [hit] = await detector.detect(video);
              if (hit) found(hit.rawValue);
            } catch {
              // A failed frame is not an error; try the next one.
            }
          }, 250);
        } catch (err) {
          fail(err);
        }
      })();
    } else {
      (async () => {
        try {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          if (stopped) return;
          const hints = new Map<unknown, unknown>([
            [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
          ]);
          const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 250 });
          const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
            // The callback also fires with "nothing found in this frame"; only a result matters.
            if (result) found(result.getText());
          });
          stop = () => controls.stop();
          if (stopped) return stop();
          setState("scanning");
        } catch (err) {
          fail(err);
        }
      })();
    }

    return () => {
      stopped = true;
      stop();
    };
  }, [onDetected]);

  if (state === "unsupported") {
    return (
      <p className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
        This browser cannot use the camera here. Type the number printed under the barcode instead.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
        Camera access is off for this site. Allow it in your browser settings, or type the
        barcode number below.
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
        The camera could not be started. Type the barcode number below instead.
      </p>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper-sunk">
      <video ref={videoRef} playsInline muted className="size-full object-cover" aria-label="Camera view for barcode scanning" />
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 border-2 border-paper/90" />
      <p className="label absolute inset-x-0 bottom-2 text-center text-paper mix-blend-difference" role="status">
        {state === "starting" ? "Starting camera…" : "Hold the barcode inside the frame"}
      </p>
    </div>
  );
}
