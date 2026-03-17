import { NextResponse } from 'next/server';
import { neighbourhoodsByDistrictAndCityCode } from 'turkey-neighbourhoods';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cityCode = searchParams.get('cityCode');
  const district = searchParams.get('district');
  if (!cityCode || !district) {
    return NextResponse.json([], { status: 400 });
  }

  const cityDistricts = (neighbourhoodsByDistrictAndCityCode as Record<string, Record<string, string[]>>)[cityCode];
  if (!cityDistricts) {
    return NextResponse.json([]);
  }

  const neighbourhoods: string[] = cityDistricts[district] || [];

  const result = neighbourhoods
    .map((name) => ({ name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
