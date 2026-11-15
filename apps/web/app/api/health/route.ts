import { NextResponse } from 'next/server';

/**
 * GET /api/health — healthcheck para Railway (y para el propio desarrollo).
 * Responde siempre rápido, sin tocar servicios externos.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'orbitstreet-web',
    timestamp: new Date().toISOString()
  });
}
