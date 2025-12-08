// const jwt = require('jsonwebtoken');
// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');

// const protect = asyncHandler(async (req, res, next) => {
//   let token;

//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith('Bearer')
//   ) {
//     try {
//       token = req.headers.authorization.split(' ')[1];

//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       req.user = await User.findById(decoded.id).select('-passwordHash');
//       next();
//     } catch (error) {
//       console.error(error);
//       res.status(401);
//       throw new Error('Not authorized, token failed');
//     }
//   }

//   if (!token) {
//     res.status(401);
//     throw new Error('Not authorized, no token');
//   }
// });

// module.exports = { protect };


const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    // DEBUG: See what is actually coming in
    // console.log("Cookies:", req.cookies.accessToken);
    // console.log("Header:", req.headers.authorization);

    // 1. Priority: Check Cookie (Secure, HttpOnly)
    if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    
    // 2. Fallback: Check Header (Mobile/API)
    // 🚨 SAFETY CHECK: Ensure we don't accidentally read "Bearer undefined"
    else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer') &&
        !req.headers.authorization.includes('undefined') && 
        !req.headers.authorization.includes('null')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-passwordHash');
        
        if (!req.user) {
            res.status(401);
            throw new Error('User not found');
        }

        next();
    } catch (error) {
        console.error("Auth Error:", error.message);
        // Clear the bad cookie so the browser stops sending it
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        
        res.status(401);
        throw new Error('Not authorized, session expired or invalid');
    }
});

module.exports = { protect };