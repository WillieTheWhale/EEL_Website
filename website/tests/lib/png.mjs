// Minimal 8-bit RGB/RGBA PNG codec (enough for Chrome screenshots).
import zlib from 'node:zlib';

const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

export class PNG {
  constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8Array(width * height * 4); }

  static decode(buf) {
    let pos = 8, width, height, bitDepth, colorType, idat = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
      const chunk = buf.subarray(pos + 8, pos + 8 + len);
      if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); bitDepth = chunk[8]; colorType = chunk[9]; }
      else if (type === 'IDAT') idat.push(chunk);
      else if (type === 'IEND') break;
      pos += 12 + len;
    }
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported PNG ${bitDepth}/${colorType}`);
    const bpp = colorType === 6 ? 4 : 3;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const img = new PNG(width, height);
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = line[i];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[i] = v & 0xff;
      }
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        img.data[o] = cur[x * bpp]; img.data[o + 1] = cur[x * bpp + 1]; img.data[o + 2] = cur[x * bpp + 2]; img.data[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
      }
      [prev, cur] = [cur, prev];
    }
    return img;
  }

  static encode(img) {
    const { width, height, data } = img;
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
    const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb)); return Buffer.concat([len, tb, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
  }
}
