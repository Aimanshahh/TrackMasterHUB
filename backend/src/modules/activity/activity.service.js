import Activity from '../../models/Activity.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

async function buildFilter({ q, type, page, limit }) {
  const filter = {};

  if (q) {
    const regex = new RegExp(q.trim(), 'i');
    filter.$or = [
      { label: regex },
      { description: regex },
    ];
  }

  if (type) {
    filter.type = type;
  }

  return filter;
}

async function listActivity({ filter, sort, direction, page, limit }) {
  const skip = (page - 1) * limit;

  const sortObj = {};
  sortObj[sort] = direction === 'desc' ? -1 : 1;

  const [rows, total] = await Promise.all([
    Activity.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('actor', 'id name email role'),
    Activity.countDocuments(filter),
  ]);

  return {
    data: rows.map((a) => a.toApiJson()),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getActivity(req, res, next) {
  try {
    const { q, type, sort = 'createdAt', direction = 'desc', page = '1', limit = '20' } = req.query;

    const filter = await buildFilter({ q, type });

    const result = await listActivity({ filter, sort, direction, page: Number(page), limit: Number(limit) });

    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export { getActivity };
