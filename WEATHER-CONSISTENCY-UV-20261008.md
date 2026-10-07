# Current conditions, precipitation and UV — 2026.10.08.3

## Reproduction and source comparison

The supplied București screenshot at 01:14 showed rain, but 0% in the first precipitation slot. At 2026-10-07 22:18 UTC the public forecast's current condition came from OpenWeather (code 61, 0.65 mm); MET Norway supplied dry upcoming hours. Direct MET Norway and Open-Meteo queries also reported a dry interval. Nearby LRBS/LROP airport METAR reports were CAVOK at 22:00 UTC. Airport observations support this comparison but cannot prove conditions at every street in the city.

The deployed server was using its MET fallback because the full Open-Meteo base query was unavailable there. In that case UV remained null. A client supplement also failed to run when precipitation probabilities were already complete, even though current UV was missing.

## Changes

- A recent native MET Norway interval now supplies current sky conditions and precipitation consistently with the upcoming forecast. Recent OpenWeather numeric observations, including temperature, remain available. Field-level source metadata distinguishes them. If MET coverage is stale, unknown or absent, existing backups remain usable.
- Native six-hour precipitation amounts are converted to an hourly mean. The current precipitation slot displays mm/h; later slots display forecast probabilities and their available precipitation amounts. Zero probabilities are never manufactured to conceal disagreement between providers.
- The optional client request completes current and hourly UV and native daily UV maxima alongside missing precipitation probabilities. It runs when current UV is missing even if all probabilities are present. It accepts real zero, rejects stale current UV, matches hourly UTC timestamps and daily dates in the city's timezone, and never substitutes daily peak UV for current UV.
- UV refresh replaces only the relevant cards and updates the advice context. Maps, background and scroll remain in place. Supplementation does not renew the underlying forecast's freshness timestamp.
- Full server forecast caches require source revision 2026.10.08.3; client forecast storage moves to meteo-forecast-cache-v2. Saved cities remain unchanged. Versioned script v4 and service-worker cache v43 deliver the change.
- Weather credits now identify recent observations separately from sky and precipitation forecasts.

No extra server provider requests are introduced. Client supplements remain coalesced per city, with timeout and retry backoff. Forecast estimates can still differ from local reality; the correction does not promise observational coverage of every location.

## Validation

- All 54 Python tests passed, including source fallback, native intervals, cache invalidation, request coalescing and current-condition ownership.
- UV and precipitation cache tests passed: existing probabilities preserved, missing UV completed, real zero accepted, stale UV rejected, native daily maxima kept separate, Tokyo date handling and provider failure.
- Mobile and notification regressions and JavaScript syntax checks passed.
- Browser checks passed for dry current precipitation, wet current precipitation, future percentages, UV 0 at night, UV 5.4 during the day, the UV bar marker, and preservation of maps/background.
- Browser checks passed for slow/failed/out-of-order city switching, persistence, bounded caches, coalesced requests, cold GPS startup, provider retries and automatic network recovery.
- Local-time advice tests passed for Moreni, NYC, night advice, city ownership and delayed replies.
- Live lightweight Open-Meteo queries returned 240 hourly UV values for București and NYC. București current UV was 0 while its daily maximum was 4.15; NYC current UV was 0.05 while its daily maximum was 5.

Browser checks use Edge with mobile viewport emulation; this is not a physical S24 Ultra test. Public asset and live source checks are recorded under 03-Testare-si-capturi/tests.

## Primary references

- https://docs.api.met.no/doc/ForecastJSON.html — native forecast interval semantics.
- https://open-meteo.com/en/docs — precipitation probability and current/hourly/daily UV fields.
- https://aviationweather.gov/data/api/ — nearby airport observation comparison.
