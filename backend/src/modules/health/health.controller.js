import { getHealthSnapshot } from './health.service.js';

export function getHealth(req, res) {
  res.set('Cache-Control', 'no-store');
  res.status(200).json(getHealthSnapshot());
}
