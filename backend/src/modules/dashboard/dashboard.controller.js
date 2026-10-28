import express from 'express';
import { getDashboard } from './dashboard.service.js';

async function getDashboardData(req, res, next) {
  try {
    const data = await getDashboard();
    return res.json({ data });
  } catch (error) {
    next(error);
  }
}

export { getDashboardData };
