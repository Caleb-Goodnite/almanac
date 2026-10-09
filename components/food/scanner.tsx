"use client";

import { useEffect, useRef, useState } from "react";

type Detected = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<Detected[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

function detectorCtor(): DetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
}

/**
 * Live barcode scanning with the browser's built-in BarcodeDetector.
 * Frames stay on the device: only the decoded number is sent to the server.
 * Where the API is missing (Safari and Firefox at the time of writing) the
 * panel says so and the manual entry below still works.
 */
export function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // This component is loaded client-side only, so the browser check can run during the first render.
  const [state, setState] = useState<"starting" | "scanning" | "unsupported" | "denied" | "error">(() =>
    detectorCtor() && "mediaDevices" in navigator ? "starting" : "unsupported",
  );

  useEffect(() => {
    const Ctor = detectorCtor();
    if (!Ctor || !("mediaDevices" in navigator)) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState("scanning");

        const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        // Four reads a second is plenty and keeps the main thread free.
        timer = setInterval(async () => {
          if (video.readyState < 2) return;
          try {
            const [hit] = await detector.detect(video);
            if (hit && /^\d{8,14}$/.test(hit.rawValue)) {
              if (timer) clearInterval(timer);
              navigator.vibrate?.(40);
              onDetected(hit.rawValue);
            }
          } catch {
            // A failed frame is not an error; try the next one.
          }
        }, 250);
      } catch (err) {
        setState(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "error");
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  if (state === "unsupported") {
    return (
      <p className="border-l-2 border-accent py-1 pl-3 text-sm leading-relaxed text-ink-soft">
        This browser cannot scan barcodes with the camera. Type the number printed under the
        barcode instead.
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
