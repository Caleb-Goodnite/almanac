import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/*
 * Builds a short uncompressed video (Y4M) of an EAN-13 barcode, which Chromium
 * can play as a fake camera. That lets the scanner be tested end to end with
 * no real camera and no binary fixture in the repository.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Appends the EAN-13 check digit to 12 digits. */
export function ean13(twelve: string): string {
  const sum = [...twelve].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return twelve + String((10 - (sum % 10)) % 10);
}

function modules(code: string): string {
  const digits = [...code].map(Number);
  const parity = PARITY[digits[0]!]!;
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? L : G)[digits[i]!]!;
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[digits[i]!]!;
  return bits + "101";
}

export function writeBarcodeVideo(code: string, file: string): string {
  const width = 640;
  const height = 480;
  const bits = modules(code);
  const scale = 5; // pixels per module: 95 modules = 475 px, leaving quiet zones either side
  const left = Math.floor((width - bits.length * scale) / 2);

  const y = Buffer.alloc(width * height, 235); // white
  for (let row = 110; row < 370; row++) {
    for (let m = 0; m < bits.length; m++) {
      if (bits[m] === "1") y.fill(16, row * width + left + m * scale, row * width + left + (m + 1) * scale);
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`), ...Array.from({ length: 10 }, () => frame)]));
  return file;
}
