import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

let cached: string | null = null

export async function GET() {
  if (!cached) {
    const path = join(process.cwd(), 'public', 'data', 'watersheds-simple.geojson')
    cached = readFileSync(path, 'utf-8')
  }
  return new NextResponse(cached, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
  })
}
