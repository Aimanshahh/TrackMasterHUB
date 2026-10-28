import { getActivity } from './activity.service.js';

async function getActivityHandler(req, res, next) {
  try {
    return getActivity(req, res, next);
  } catch (error) {
    next(error);
  }
}

export { getActivityHandler };
