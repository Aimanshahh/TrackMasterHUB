import User from '../../models/User.js';

/** Dashboard figures read from MongoDB directly. No client-side fallback data. */
async function getDashboard() {
  const [adminCount, salespersonCount, managerCount, operationsCount, customerCount, recentUsers] = await Promise.all([
    User.countDocuments({ role: 'admin', active: true }),
    User.countDocuments({ role: 'salesperson', active: true }),
    User.countDocuments({ role: 'manager', active: true }),
    User.countDocuments({ role: 'operations', active: true }),
    User.countDocuments({ role: 'salesperson' }).exec(),
    User.find({ role: 'salesperson' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt'),
  ]);

  return {
    counts: {
      admin: adminCount,
      salesperson: salespersonCount,
      manager: managerCount,
      operations: operationsCount,
      totalUsers: adminCount + salespersonCount + managerCount + operationsCount,
      totalCustomers: customerCount,
    },
    recentSalesforce: recentUsers.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

export { getDashboard };
