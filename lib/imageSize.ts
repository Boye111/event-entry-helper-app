/** Reads width/height from a PNG or JPEG header. Returns null for anything else. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: fixed position in the IHDR chunk
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk the segments until a start-of-frame marker
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2; // markers without a length
        continue;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Largest width/height that fits inside a box while keeping the picture's shape. */
export function fitInside(size: { width: number; height: number } | null, maxW: number, maxH: number) {
  if (!size || !size.width || !size.height) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / size.width, maxH / size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}
