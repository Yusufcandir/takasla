import { NextResponse } from 'next/server';
import { City } from 'country-state-city';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get('countryCode');
  const stateCode = searchParams.get('stateCode');
  if (!countryCode || !stateCode) {
    return NextResponse.json([], { status: 400 });
  }

  const cities = City.getCitiesOfState(countryCode, stateCode).map((c) => ({
    name: c.name,
    stateCode: c.stateCode,
    countryCode: c.countryCode,
  }));

  cities.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(cities, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
