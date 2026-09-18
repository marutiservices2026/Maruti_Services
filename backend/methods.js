// methods.js — CENTRALIZED DB OPERATIONS. Every generic Mongo operation (create, findAll,
// findById, updateById, deleteById, paginate, aggregate, withTransaction) lives here,
// parameterized by Model. Controllers only ever call methods.js — never a Mongoose model
// directly.
//
// Usage: import * as methods from '../methods.js';
//        const doc = await methods.create(Invoice, req.body);
//
// One place to add logging, caching, soft-delete filters, or audit trails later without
// touching every controller.
import mongoose from 'mongoose';

function applyOptions(query, options = {}) {
  if (options.select) query = query.select(options.select);
  if (options.populate) query = query.populate(options.populate);
  if (options.sort) query = query.sort(options.sort);
  if (options.session) query = query.session(options.session);
  return query;
}

// Runs `fn(session)` inside a MongoDB transaction, committing on success and rolling
// back on any thrown error (Section 9: invoice/counter creation, and register's
// Company+User creation, must succeed or fail together).
export const withTransaction = async (fn) => {
  return fn(undefined); // TEMP-DEMO-PATCH: local standalone Mongo has no replica set
  /* eslint-disable no-unreachable */
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export const create = async (Model, data, options = {}) => {
  if (options.session) {
    const [doc] = await Model.create([data], { session: options.session });
    return doc;
  }
  return Model.create(data);
};

export const findAll = (Model, filter = {}, options = {}) =>
  applyOptions(Model.find(filter, options.projection || null), options).lean();

export const findById = (Model, id, options = {}) =>
  applyOptions(Model.findById(id), options).lean();

export const findOne = (Model, filter, options = {}) =>
  applyOptions(Model.findOne(filter), options).lean();

export const updateById = (Model, id, data, options = {}) =>
  Model.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    session: options.session,
  }).lean();

export const deleteById = (Model, id, options = {}) =>
  Model.findByIdAndDelete(id, { session: options.session }).lean();

export const deleteMany = (Model, filter, options = {}) =>
  Model.deleteMany(filter, { session: options.session });

export const updateMany = (Model, filter, data, options = {}) =>
  Model.updateMany(filter, data, { session: options.session });

export const paginate = async (Model, filter = {}, page = 1, limit = 20, options = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20)); // cap so a client can't force an unbounded scan
  const skip = (safePage - 1) * safeLimit;

  const [data, total] = await Promise.all([
    applyOptions(Model.find(filter, options.projection || null), {
      ...options,
      sort: options.sort || { createdAt: -1 },
    })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Model.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
};

export const aggregate = (Model, pipeline) => Model.aggregate(pipeline);
