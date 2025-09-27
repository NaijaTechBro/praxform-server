const jwt = require('jsonwebtoken');

const generateToken = (userId, role) => {

  const payload = {
    userId,
    role
  }
  return jwt.sign({ payload }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY,
  });
};

module.exports = generateToken;