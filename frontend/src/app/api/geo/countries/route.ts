import { NextRequest, NextResponse } from 'next/server';
import { Country } from 'country-state-city';

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const all = Country.getAllCountries();

  // Use Intl.DisplayNames to translate country names when locale is not English
  let displayNames: Intl.DisplayNames | null = null;
  if (locale !== 'en') {
    try { displayNames = new Intl.DisplayNames([locale], { type: 'region' }); } catch { /* fallback to English */ }
  }

  const countries = all.map((c) => ({
    name: displayNames ? (displayNames.of(c.isoCode) || c.name) : c.name,
    isoCode: c.isoCode,
    phoneCode: c.phonecode,
    flag: c.flag,
  }));

  // Sort Turkey first, then alphabetical
  countries.sort((a, b) => {
    if (a.isoCode === 'TR') return -1;
    if (b.isoCode === 'TR') return 1;
    return a.name.localeCompare(b.name, locale);
  });

  return NextResponse.json(countries, {
    headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
  });
}
