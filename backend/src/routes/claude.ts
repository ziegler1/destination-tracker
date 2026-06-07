import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

const SYSTEM: Anthropic.Messages.TextBlockParam = {
  type: 'text',
  text: `You are Waypoint, an expert travel companion specializing in US and Canada travel. \
You help travelers discover destinations, plan trips, and make the most of their road adventures. \
Be specific, enthusiastic, and practical. Always provide actionable recommendations tailored to \
North American road travel. When returning structured data, respond with valid JSON only — no \
markdown fences, no extra prose.`,
  // @ts-expect-error cache_control is a valid Anthropic extension
  cache_control: { type: 'ephemeral' },
};

function textOf(msg: Anthropic.Messages.Message): string {
  const block = msg.content[0];
  return block.type === 'text' ? block.text : '';
}

// Claude sometimes wraps JSON in ```json fences or adds prose despite instructions —
// extract the JSON object/array text so callers can JSON.parse it directly.
function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const start = Math.min(
      ...[text.indexOf('{'), text.indexOf('[')].filter((i) => i !== -1),
    );
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (Number.isFinite(start) && end > start) text = text.slice(start, end + 1);
  }
  return text;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// POST /api/claude/suggest-destination
router.post('/suggest-destination', asyncHandler(async (req, res) => {
  const { preferences, visitedDestinations = [] } = req.body;
  const visited =
    Array.isArray(visitedDestinations) && visitedDestinations.length
      ? visitedDestinations.join(', ')
      : 'none yet';

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Travel preferences: ${preferences}\nAlready visited: ${visited}\n\n` +
          `Suggest 3 US or Canada destinations I should visit next. For each return a JSON object ` +
          `with keys: name, state_province, country, description, top_activities (array), ` +
          `best_months (array). Return a JSON array of 3 objects.`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/best-time-to-visit
router.post('/best-time-to-visit', asyncHandler(async (req, res) => {
  const { destination, location } = req.body;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `What is the best time to visit ${destination} in ${location}? ` +
          `Cover: weather by season, crowd levels, notable events, and any months to avoid. ` +
          `Return JSON with keys: best_months (array of month names), summary (string), ` +
          `seasons (object with spring/summer/fall/winter keys, each a brief string).`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/packing-suggestions
router.post('/packing-suggestions', asyncHandler(async (req, res) => {
  const { tripName, destinations = [], duration, activities = [] } = req.body;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Create a packing list for trip "${tripName}".\n` +
          `Destinations: ${destinations.join(', ') || 'general road trip'}\n` +
          `Duration: ${duration ?? '?'} days\n` +
          `Activities: ${activities.join(', ') || 'general sightseeing'}\n\n` +
          `Return JSON with key: categories — an array of { name: string, items: string[] }.`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/trip-summary
router.post('/trip-summary', asyncHandler(async (req, res) => {
  const { trip } = req.body;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Write a vivid 2–3 paragraph travel narrative for this trip:\n` +
          `${JSON.stringify(trip, null, 2)}\n\n` +
          `Use second person ("you visited…"). Highlight standout moments and give an overall ` +
          `impression. Return plain prose — no JSON.`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/travel-insights
router.post('/travel-insights', asyncHandler(async (req, res) => {
  const { stats, records, cuisineBreakdown } = req.body;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Analyze this traveler's history and generate 5 personalized insights. Be specific — ` +
          `reference actual places, cuisines, and patterns from the data.\n\n` +
          `Stats: ${JSON.stringify(stats)}\n` +
          `Records: ${JSON.stringify(records)}\n` +
          `Cuisine breakdown: ${JSON.stringify(cuisineBreakdown)}\n\n` +
          `Return a JSON array of 5 objects with keys: icon (single emoji), headline (≤8 words), ` +
          `detail (1–2 sentences, specific and personal).`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/restaurant-description
router.post('/restaurant-description', asyncHandler(async (req, res) => {
  const { restaurant } = req.body;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Write a mouth-watering 2–3 sentence description for this restaurant:\n` +
          `${JSON.stringify(restaurant, null, 2)}\n\n` +
          `Focus on cuisine, atmosphere, and standout qualities. Return plain prose — no JSON.`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/generate-highlights
router.post('/generate-highlights', asyncHandler(async (req, res) => {
  const { type, name, city, state, details } = req.body as {
    type?: 'lodging' | 'restaurant' | 'destination' | 'special_interest';
    name?: string; city?: string; state?: string; details?: string;
  };
  if (!name) return void res.status(400).json({ error: 'name is required' });

  const kind = (
    {
      lodging: 'lodging (hotel/motel/resort/etc.)',
      restaurant: 'restaurant',
      destination: 'travel destination',
      special_interest: 'point of interest',
    } as Record<string, string>
  )[type ?? ''] ?? 'place';
  const location = [city, state].filter(Boolean).join(', ');

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Write 2–3 enthusiastic sentences highlighting what makes "${name}"` +
          (location ? ` in ${location}` : '') +
          `, a ${kind}, worth visiting` +
          (details ? ` (category: ${details})` : '') +
          `. Focus on standout features, atmosphere, and what travelers should look forward to. ` +
          `Return plain prose — no JSON, no markdown.`,
      },
    ],
  });
  res.json({ result: textOf(msg) });
}));

// POST /api/claude/scrape-website
router.post('/scrape-website', asyncHandler(async (req, res) => {
  const { url, name, entityType } = req.body as { url?: string; name?: string; entityType?: string };
  if (!url) return void res.status(400).json({ error: 'url is required' });

  let text = '';
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Waypoint/1.0; +travel planning app)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await pageRes.text();
    text = htmlToText(html).slice(0, 12000);
  } catch {
    return void res.status(502).json({ error: 'Could not fetch that website' });
  }
  if (!text) return void res.status(502).json({ error: 'That website returned no readable content' });

  const kind = entityType === 'lodging' ? 'lodging (hotel/motel/resort/etc.)' : 'restaurant';
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [SYSTEM],
    messages: [
      {
        role: 'user',
        content:
          `Here is text scraped from the website of "${name ?? 'this place'}", a ${kind}:\n\n${text}\n\n` +
          `Extract useful info for a traveler. Return JSON with keys:\n` +
          `- description: a 1–2 sentence summary (string, or null if not enough info)\n` +
          `- hours: operating hours or check-in/check-out times if mentioned (string, or null)\n` +
          `- phone: contact phone number if found (string, or null)\n` +
          `- address: street address if found (string, or null)\n` +
          `- highlights: an array of up to 8 objects with { name: string, detail?: string } — ` +
          `for restaurants, list standout menu items with prices in "detail"; for lodging, list room types ` +
          `or notable amenities with brief details.\n\n` +
          `Use null for missing fields. Return valid JSON only — no markdown fences, no extra prose.`,
      },
    ],
  });
  res.json({ result: extractJson(textOf(msg)) });
}));

export default router;
