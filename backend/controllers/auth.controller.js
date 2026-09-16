// auth.controller.js — register/login/refresh/logout.
//
// register creates the Company profile and its first Admin user together in one
// transaction (Section 3: "single business owner" — the account holder registers their
// business once; Accountant staff are added later via a user-management screen, not
// covered by this endpoint).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import * as methods from '../methods.js';
import Company from '../models/Company.model.js';
import User from '../models/User.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

const BCRYPT_COST = 12;
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'refreshToken';

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    gstin: z.string().length(15),
    stateName: z.string().min(1),
    stateCode: z.string().min(1),
    pan: z.string().optional(),
    bankDetails: z
      .object({
        bankName: z.string().optional(),
        accountNo: z.string().optional(),
        branch: z.string().optional(),
        ifsc: z.string().optional(),
      })
      .optional(),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function signTokens(user) {
  const payload = { sub: user._id.toString(), company: user.company.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = jwt.sign(payload, env.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  return { accessToken, refreshToken };
}

// sameSite: 'none' is required in production because the frontend (Vercel) and backend
// (Render) are different sites — a 'strict' or 'lax' cookie would never be sent on the
// frontend's cross-site fetch/XHR calls. 'none' requires secure: true, which is why this
// is gated on env.isProduction rather than always-on (plain HTTP localhost can't set a
// Secure cookie).
function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company };
}

export const register = asyncHandler(async (req, res) => {
  const existing = await methods.findOne(User, { email: req.body.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await methods.withTransaction(async (session) => {
    const company = await methods.create(Company, req.body.company, { session });
    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);
    return methods.create(
      User,
      {
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        role: 'admin',
        company: company._id,
      },
      { session }
    );
  });

  const { accessToken, refreshToken } = signTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(201, { accessToken, user: toPublicUser(user) }, 'Account created.').send(res);
});

export const login = asyncHandler(async (req, res) => {
  const user = await methods.findOne(User, { email: req.body.email }, { select: '+passwordHash' });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const isMatch = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const { accessToken, refreshToken } = signTokens(user);
  setRefreshCookie(res, refreshToken);

  return new ApiResponse(200, { accessToken, user: toPublicUser(user) }, 'Logged in.').send(res);
});

// Issues a new access token from the httpOnly refresh cookie, without requiring the
// short-lived access token itself (Section 3: access tokens are short-lived by design).
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token.');
  }

  const accessToken = signAccessToken({ sub: payload.sub, company: payload.company, role: payload.role });

  return new ApiResponse(200, { accessToken }, 'Token refreshed.').send(res);
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME);
  return new ApiResponse(200, null, 'Logged out.').send(res);
});
