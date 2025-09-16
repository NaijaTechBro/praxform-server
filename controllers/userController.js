const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @desc    Get all users (admin)
// @route   GET /api/v1/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    // Assuming 'admin' role check has been performed by a middleware
    const users = await User.find({}).populate('organizations', 'name');
    res.json(users);
});

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-passwordHash').populate('organizations', 'name');

    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private
const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // Allow user to update their own profile, or admin to update any
        if (req.user._id.toString() !== user._id.toString() /* && !req.user.isAdmin */) {
            res.status(401);
            throw new Error('Not authorized to update this user');
        }

        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        
         // Handle boolean for MFA toggle
        if (typeof req.body.mfaEnabled === 'boolean') {
            user.mfaEnabled = req.body.mfaEnabled;
        }

        if (req.body.preferences) {
            user.preferences = { ...user.preferences, ...req.body.preferences };
        }

        await user.save();
        // Fetch the updated user with populated currentOrganization
        const finalUpdatedUser = await User.findById(user._id).populate('currentOrganization', 'name');

        res.json({
            _id: finalUpdatedUser._id,
            firstName: finalUpdatedUser.firstName,
            lastName: finalUpdatedUser.lastName,
            email: finalUpdatedUser.email,
            currentOrganization: finalUpdatedUser.currentOrganization,
            preferences: finalUpdatedUser.preferences,
            mfaEnabled: finalUpdatedUser.mfaEnabled
        });

    } else {
        res.status(404);
        throw new Error('User not found');
    }
});


// @desc    Enable or disable MFA for a user
// @route   PUT /api/v1/users/:id/mfa-toggle
// @access  Private
const toggleMfaStatus = asyncHandler(async (req, res) => {
    const { mfaEnabled, password } = req.body;

    if (req.user._id.toString() !== req.params.id) {
        res.status(401);
        throw new Error('Not authorized to update this user');
    }
    
    const user = await User.findById(req.user._id);

    if (!password || !(await user.matchPassword(password))) {
        res.status(401);
        throw new Error('Incorrect password.');
    }

    if (typeof mfaEnabled !== 'boolean') {
        res.status(400);
        throw new Error('Invalid value for mfaEnabled.');
    }

    user.mfaEnabled = mfaEnabled;
    await user.save();

    res.status(200).json({
        success: true,
        message: `Two-Factor Authentication has been ${mfaEnabled ? 'enabled' : 'disabled'}.`,
        mfaEnabled: user.mfaEnabled
    });
});


// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // Add logic to ensure user is an admin or the user themselves
        await user.remove();
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});


module.exports = { getUsers, getUserById, updateUser, toggleMfaStatus, deleteUser };