// Trace raw RGBA pixels into flat-color SVG outlines with Designer mode's tracer (src/lib/trace.ts).
//
// Usage: bun scripts/trace_logo.ts '{"colors":"auto","removeBackground":true}' < pixels > logo.svg
// stdin: width and height as little-endian uint32s, then width*height RGBA bytes. download_cobb_svgs.py
// decodes and scales the bitmap, then runs this so the game's assets and Designer uploads trace alike.
import { traceImage, type TraceOptions } from '../src/lib/trace'

const options = JSON.parse(process.argv[2] ?? '{}') as TraceOptions
const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
const input = Buffer.concat(chunks)
const width = input.readUInt32LE(0)
const height = input.readUInt32LE(4)
const result = traceImage({ width, height, data: input.subarray(8) }, options)
process.stdout.write(result.svg + '\n')
