const bcrypt = require('bcryptjs');

const users = [
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    passwordHash: 'AdminPassword123',
    authMethod: 'local',
  },
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    passwordHash: 'JohnPassword123',
    authMethod: 'local',
  }
];

module.exports = users;