// Remove every image, texture and sampler from a GLB and repack the binary
// chunk so the unused texture bytes are dropped. Geometry is untouched.
//
// Usage: node scripts/strip-glb-textures.mjs <in.glb> <out.glb>

import { readFileSync, writeFileSync } from "node:fs";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const TEXTURE_KEYS = [
  "normalTexture",
  "occlusionTexture",
  "emissiveTexture",
  "baseColorTexture",
  "metallicRoughnessTexture",
];

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/strip-glb-textures.mjs <in.glb> <out.glb>");
  process.exit(1);
}

const src = readFileSync(inPath);
if (src.readUInt32LE(0) !== GLB_MAGIC) throw new Error("not a GLB file");
if (src.readUInt32LE(4) !== 2) throw new Error("unsupported GLB version");

let offset = 12;
let json = null;
let bin = null;
while (offset < src.length) {
  const length = src.readUInt32LE(offset);
  const type = src.readUInt32LE(offset + 4);
  const data = src.subarray(offset + 8, offset + 8 + length);
  if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8"));
  else if (type === CHUNK_BIN) bin = data;
  offset += 8 + length;
}
if (!json || !bin) throw new Error("GLB is missing a JSON or BIN chunk");
if ((json.buffers ?? []).length !== 1) throw new Error("expected exactly one buffer");

// Buffer views referenced only by images can go. Everything else is kept
// so accessors and sparse data stay intact.
const dropViews = new Set((json.images ?? []).map((img) => img.bufferView).filter((v) => v !== undefined));
const keptViews = json.bufferViews.map((_, i) => i).filter((i) => !dropViews.has(i));
const remap = new Map(keptViews.map((oldIndex, newIndex) => [oldIndex, newIndex]));

for (const key of ["images", "textures", "samplers"]) delete json[key];
for (const material of json.materials ?? []) {
  for (const key of TEXTURE_KEYS) delete material[key];
  if (material.pbrMetallicRoughness) {
    for (const key of TEXTURE_KEYS) delete material.pbrMetallicRoughness[key];
  }
}

const align4 = (n) => (n + 3) & ~3;
const parts = [];
let cursor = 0;
json.bufferViews = keptViews.map((oldIndex) => {
  const view = json.bufferViews[oldIndex];
  const start = view.byteOffset ?? 0;
  const slice = bin.subarray(start, start + view.byteLength);
  const next = { ...view, byteOffset: cursor };
  parts.push(slice);
  cursor += slice.length;
  const pad = align4(cursor) - cursor;
  if (pad) {
    parts.push(Buffer.alloc(pad));
    cursor += pad;
  }
  return next;
});
json.buffers[0].byteLength = cursor;

const fixViewRefs = (obj) => {
  if (obj && obj.bufferView !== undefined) {
    if (!remap.has(obj.bufferView)) throw new Error("accessor references a dropped buffer view");
    obj.bufferView = remap.get(obj.bufferView);
  }
};
for (const accessor of json.accessors ?? []) {
  fixViewRefs(accessor);
  if (accessor.sparse) {
    fixViewRefs(accessor.sparse.indices);
    fixViewRefs(accessor.sparse.values);
  }
}

let jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = align4(jsonBytes.length) - jsonBytes.length;
if (jsonPad) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]);
const binBytes = Buffer.concat(parts);

const header = Buffer.alloc(12);
header.writeUInt32LE(GLB_MAGIC, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + binBytes.length, 8);

const chunk = (type, data) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(data.length, 0);
  h.writeUInt32LE(type, 4);
  return Buffer.concat([h, data]);
};

const out = Buffer.concat([header, chunk(CHUNK_JSON, jsonBytes), chunk(CHUNK_BIN, binBytes)]);
writeFileSync(outPath, out);
console.log(`${inPath}: ${src.length} bytes -> ${outPath}: ${out.length} bytes (dropped ${dropViews.size} buffer view(s))`);
