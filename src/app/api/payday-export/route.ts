import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Aer Payday Export Stub — Slot 03 → Slot 05
 *
 * This endpoint receives exported ideation JSON from Aer Ideation (Slot 03).
 * When Aer Payday (Slot 05) is built, replace this stub with a POST to its
 * actual inbox API. The payload is also stored in client localStorage under
 * the key 'aer-payday-inbox' as a client-side bridge.
 *
 * Payload shape:
 * {
 *   id: string (UUID)
 *   source: 'aer-ideation'
 *   slot: '03'
 *   createdAt: ISO string
 *   thing: string
 *   chain: Array<{ id, label, kind, description, depth }>
 *   status: 'pending'
 * }
 */
export async function POST(req: NextRequest) {
  const payload = await req.json()
  console.log(
    'payday-export: queued',
    payload.id,
    '| thing:', payload.thing,
    '| chain length:', payload.chain?.length
  )
  return NextResponse.json({
    status: 'pending',
    id: payload.id,
    message: 'Queued for Aer Payday (Slot 05). Build Payday to consume this inbox.',
  })
}
