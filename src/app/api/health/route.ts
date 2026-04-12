import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'qarvon-crm',
    timestamp: new Date().toISOString(),
  })
}
