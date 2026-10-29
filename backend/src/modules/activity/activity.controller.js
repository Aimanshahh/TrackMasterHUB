import { getActivity } from './activity.service.js';

async function getActivityHandler(req, res, next) {
  try {
    return await getActivity(req, res, next);
  } catch (error) {
    return next(error);
  }
}

export { getActivityHandler };
