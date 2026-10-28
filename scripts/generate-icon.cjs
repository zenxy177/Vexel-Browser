const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const size = 256;
const supersampling = 4;
const sampleCount = supersampling * supersampling;
const pixels = Buffer.alloc(size * size * 4);
const mark = [[58, 68], [198, 68], [198, 94], [102, 162], [198, 162], [198, 188], [58, 188], [58, 162], [154, 94], [58, 94]];
const accent = [[178, 54], [204, 54], [204, 80], [178, 80]];

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(right - radius, x));
  const cy = Math.max(top + radius, Math.min(bottom - radius, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function mix(start, end, amount) {
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
}

function sampleColor(x, y) {
  if (!insideRoundedRect(x, y, 6, 6, 250, 250, 68)) return [0, 0, 0, 0];

  if (insidePolygon(x, y, accent)) return [155, 188, 255, 255];
  if (insidePolygon(x, y, mark)) {
    const amount = Math.max(0, Math.min(1, (x + y - 100) / 300));
    return [...mix([242, 247, 255], [141, 187, 255], amount), 255];
  }

  const border = !insideRoundedRect(x, y, 7.5, 7.5, 248.5, 248.5, 66.5);
  const amount = Math.max(0, Math.min(1, (x + y) / 512));
  return [...mix(border ? [169, 201, 255] : [24, 35, 50], border ? [169, 201, 255] : [11, 14, 19], amount), border ? 52 : 255];
}

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const total = [0, 0, 0, 0];
    for (let sy = 0; sy < supersampling; sy++) {
      for (let sx = 0; sx < supersampling; sx++) {
        const color = sampleColor(x + (sx + 0.5) / supersampling, y + (sy + 0.5) / supersampling);
        for (let channel = 0; channel < 4; channel++) total[channel] += color[channel];
      }
    }
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 4; channel++) pixels[offset + channel] = Math.round(total[channel] / sampleCount);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

const scanlines = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y++) {
  const row = y * (size * 4 + 1);
  scanlines[row] = 0;
  pixels.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 1, 0, 0, 0, 1, 0, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', zlib.deflateSync(scanlines)),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt16LE(1, 6);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(png.length, 14);
icoHeader.writeUInt32LE(icoHeader.length, 18);

const publicDir = path.join(__dirname, '../public');
fs.writeFileSync(path.join(publicDir, 'zny-mark.png'), png);
fs.writeFileSync(path.join(publicDir, 'zny.ico'), Buffer.concat([icoHeader, png]));
