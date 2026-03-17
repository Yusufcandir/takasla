import { NextResponse } from 'next/server';
import { districtsByCityCode } from 'turkey-neighbourhoods';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cityCode = searchParams.get('cityCode');
  if (!cityCode) {
    return NextResponse.json([], { status: 400 });
  }

  const districts: string[] = (districtsByCityCode as Record<string, string[]>)[cityCode] || [];

  // Return as sorted array of { name } objects
  const result = districts
    .map((name) => ({ name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
