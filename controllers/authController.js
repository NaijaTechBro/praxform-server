const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, organization } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const newOrganization = await Organization.create({
        name: organization.name,
        slug: organization.name.toLowerCase().replace(/\s+/g, '-'),
        industry: organization.industry
    });

    const user = await User.create({
        firstName,
        lastName,
        email,
        passwordHash: password,
        organizations: [newOrganization._id],
        currentOrganization: newOrganization._id
    });

    newOrganization.members.push({ userId: user._id, role: 'owner' });
    await newOrganization.save();

    if (user) {
        res.status(201).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Auth user & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Get user profile
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});


module.exports = { registerUser, loginUser, getMe };