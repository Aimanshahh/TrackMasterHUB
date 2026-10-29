import { getDashboard } from './dashboard.service.js';

async function getDashboardData(_req, res, next) {
  try {
    return res.json({ data: await getDashboard() });
  } catch (error) { return next(error); }
}

export { getDashboardData };
