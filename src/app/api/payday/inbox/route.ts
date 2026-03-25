import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Stub-inkorg for Aer Payday (Slot 05).
// Tar emot derivation-paket fran Aer Ideation (Slot 03).
// Nar Payday-repot byggs ersatts denna med ett riktigt API.
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    console.log(
      'aer-payday: inkorg mottog projekt:',
      payload.derivationId,
      '|',
      payload.thing,
      '| steg:',
      payload.path?.length ?? 0
    )
    return NextResponse.json({
      status: 'pending',
      derivationId: payload.derivationId,
      message: 'Projektet \u00e4r mottaget och v\u00e4ntar i \u00c6r Payday-inkorgen.',
      receivedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('aer-payday: inkorg-fel:', err)
    return NextResponse.json(
      { error: 'Kunde inte ta emot projektet.' },
      { status: 500 }
    )
  }
}
