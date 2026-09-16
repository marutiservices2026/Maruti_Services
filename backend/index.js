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

app.use('/api/v1', router);

// Unmatched routes flow through the same ApiError -> error.middleware.js shape rather
// than Express's default HTML 404.
app.use((req, res, next) => next(ApiError.notFound(`Route not found: ${req.originalUrl}`)));

// Must be mounted last — Express identifies error middleware by its 4-argument signature.
app.use(errorMiddleware);

connectDB().then(() => {
  app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
});
