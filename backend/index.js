// index.js — ENTRY POINT: builds the express app, connects DB, starts the HTTP server.
// Used to be split into app.js (build the app) + index.js (run it) — the standard reason
// for that split is so a test file can `import app from './app.js'` and hit routes with
// supertest without ever connecting to a real database or binding a port. This project has
// no automated test suite (see understand.md §10 — verification is live, via the
// browser-automation skill against the running dev servers), so that benefit didn't apply,
// and merged 2026-09-15 at the user's request. If an automated test suite is added later,
// pulling the express-app-building code back out into its own module (exporting `app`
// before `connectDB()`/`app.listen()` run) is the way to get that isolation back.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { validateEnv, env } from './config/env.js';
import connectDB from './config/db.js';
import router from './router.js';
import errorMiddleware from './middlewares/error.middleware.js';
import ApiError from './utils/ApiError.js';

validateEnv();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// GET /health — the one deliberate exception to this app's "every route is POST" rule
// (see router.js's own header comment and CLAUDE.md). Health checks are conventionally GET
// everywhere — Render's own platform health monitoring (see render.yaml's
// `healthCheckPath`) and the external keep-alive pinger both expect it, and neither should
// need to know this API's POST-only convention just to ask "are you up." Deliberately does
// NOT touch the database — the whole point is confirming the Node process itself is alive
// and responding, so a transient DB hiccup shouldn't make this report unhealthy.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/v1', router);

// Unmatched routes flow through the same ApiError -> error.middleware.js shape rather
// than Express's default HTML 404.
app.use((req, res, next) => next(ApiError.notFound(`Route not found: ${req.originalUrl}`)));

// Must be mounted last — Express identifies error middleware by its 4-argument signature.
app.use(errorMiddleware);

connectDB().then(() => {
  app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
});
