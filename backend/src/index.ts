import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './migrate';
import { errorHandler } from './middleware/errorHandler';
import destinationsRouter from './routes/destinations';
import restaurantsRouter from './routes/restaurants';
import lodgingRouter from './routes/lodging';
import tripsRouter from './routes/trips';
import stopsRouter from './routes/stops';
import expensesRouter from './routes/expenses';
import packingRouter from './routes/packing';
import journalRouter from './routes/journal';
import fuelRouter from './routes/fuel';
import weatherRouter from './routes/weather';
import uploadsRouter from './routes/uploads';
import claudeRouter from './routes/claude';
import statsRouter    from './routes/stats';
import geocodeRouter  from './routes/geocode';
import wizardRouter   from './routes/tripWizard';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// In production set CORS_ORIGIN to the frontend domain (comma-separated for multiple)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true; // allow all in dev

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/destinations', destinationsRouter);
app.use('/api/restaurants',  restaurantsRouter);
app.use('/api/lodging',      lodgingRouter);
app.use('/api/trips',        tripsRouter);

// Nested trip resources — order matters: more-specific paths first
app.use('/api/trips/:tripId/stops',    stopsRouter);
app.use('/api/trips/:tripId/expenses', expensesRouter);
app.use('/api/trips/:tripId/packing',  packingRouter);
app.use('/api/trips/:tripId/journal',  journalRouter);
app.use('/api/trips/:tripId/fuel',     fuelRouter);

app.use('/api/weather', weatherRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/claude',  claudeRouter);
app.use('/api/stats',         statsRouter);
app.use('/api/geocode',       geocodeRouter);
app.use('/api/trips/wizard',  wizardRouter);

app.use(errorHandler);

async function start(): Promise<void> {
  await runMigrations();
  app.listen(PORT, () => console.log(`Waypoint backend listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
