import User from '../../models/User.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { listUsers } from '../auth/auth.service.js';

async function getUsers({ role, search }) {
  const filter = { active: true };

  if (role) {
    filter.role = role;
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
    ];
  }

  const users = await User.find(filter).sort({ createdAt: -1 });

  return users.map((user) => user.toApiJson());
}

async function getUserById(id) {
  return User.findById(id);
}

async function changeRole(input) {
  const user = await User.findById(input.id);

  if (!user) {
    throw makeError(errorCodes.NOT_FOUND, 'No account matches that id.');
  }

  if (user.role === 'admin') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'The admin account cannot be changed.');
  }

  if (input.role === 'admin') {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Only an admin can hold the admin role.');
  }

  if (input.role === user.role) {
    return user.toApiJson();
  }

  user.role = input.role;
  await user.save();

  return user.toApiJson();
}

export { getUsers, getUserById, changeRole };
