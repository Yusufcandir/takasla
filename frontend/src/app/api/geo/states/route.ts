import { NextResponse } from 'next/server';
import { State } from 'country-state-city';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get('countryCode');
  if (!countryCode) {
    return NextResponse.json([], { status: 400 });
  }

  const states = State.getStatesOfCountry(countryCode).map((s) => ({
    name: s.name,
    isoCode: s.isoCode,
    countryCode: s.countryCode,
  }));

  // Sort alphabetically
  states.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(states, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
