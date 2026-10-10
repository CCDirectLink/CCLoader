// Run with Bun to redraw the Deps glyph, including Impact's font metric row.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const pixels = [
    '.....DDDDDD.....',
    '.....DWWWWD.....',
    '.....DWCCBD.....',
    '.....DCCBBD.....',
    '.....DDDDDD.....',
    '.......DBD......',
    '.......DBD......',
    '..DDDDDDDDDDD...',
    '..DWWWWWWWWBD...',
    '..DBD.....DBD...',
    'DDDDDD....DDDDDD',
    'DWWWWD....DWWWWD',
    'DWCCBD....DWCCBD',
    'DCCBBD....DCCBBD',
    'DBBBBD....DBBBBD',
    'DDDDDD....DDDDDD'
];
const palette = {
    '.': [0, 0, 0, 0], D: [19, 35, 67, 255],
    W: [246, 251, 255, 255], C: [99, 223, 255, 255], B: [35, 127, 189, 255]
};
const size = 17;
const scanlines = Buffer.alloc(size * (1 + size * 4));
for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
        const color = x === 16 ? palette['.'] : y === 16 ? palette.W : palette[pixels[y][x]];
        scanlines.set(color, y * (1 + size * 4) + 1 + x * 4);
    }
}
function chunk(type, data) {
    const bytes = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, bytes, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6; // RGBA
writeFileSync(new URL('./deps-icon.png', import.meta.url), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))
]));
