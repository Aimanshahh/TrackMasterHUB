import Activity from '../../models/Activity.js';
import Approval from '../../models/Approval.js';
import Customer from '../../models/Customer.js';
import User from '../../models/User.js';

async function getDashboard() {
  const [adminCount, salespersonCount, managerCount, operationsCount, customerCount, pendingApprovals, recentActivity] = await Promise.all([
    User.countDocuments({ role: 'admin', active: true }),
    User.countDocuments({ role: 'salesperson', active: true }),
    User.countDocuments({ role: 'manager', active: true }),
    User.countDocuments({ role: 'operations', active: true }),
    Customer.countDocuments(),
    Approval.countDocuments({ status: 'pending' }),
    Activity.find().sort({ createdAt: -1 }).limit(6).populate('actor', 'name role'),
  ]);

  return {
    counts: {
      admins: adminCount,
      salespeople: salespersonCount,
      managers: managerCount,
      operationsUsers: operationsCount,
      totalUsers: adminCount + salespersonCount + managerCount + operationsCount,
      totalCustomers: customerCount,
      pendingApprovals,
    },
    recentActivity: recentActivity.map((row) => row.toApiJson()),
  };
}

export { getDashboard };
