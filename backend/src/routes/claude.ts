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

export default router;
