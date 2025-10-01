// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');
// const { deleteFromCloudinary } = require('../utils/cloudinary');

// // @desc    Get all users (admin)
// // @route   GET /api/v1/users
// // @access  Private/Admin
// const getUsers = asyncHandler(async (req, res) => {
//     // Assuming 'admin' role check has been performed by a middleware
//     const users = await User.find({}).populate('organizations', 'name');
//     res.json(users);
// });

// // @desc    Get user by ID
// // @route   GET /api/v1/users/:id
// // @access  Private/Admin
// const getUserById = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.params.id).select('-passwordHash').populate('organizations', 'name');

//     if (user) {
//         res.json(user);
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// // @desc    Update user
// // @route   PUT /api/v1/users/:id
// // @access  Private
// const updateUser = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.params.id);

//     if (user) {
//         // Allow user to update their own profile, or admin to update any
//         if (req.user._id.toString() !== user._id.toString() /* && !req.user.isAdmin */) {
//             res.status(401);
//             throw new Error('Not authorized to update this user');
//         }

//         user.firstName = req.body.firstName || user.firstName;
//         user.lastName = req.body.lastName || user.lastName;
        
//          // Handle boolean for MFA toggle
//         if (typeof req.body.mfaEnabled === 'boolean') {
//             user.mfaEnabled = req.body.mfaEnabled;
//         }

//         if (req.body.preferences) {
//             user.preferences = { ...user.preferences, ...req.body.preferences };
//         }

//         await user.save();
//         // Fetch the updated user with populated currentOrganization
//         const finalUpdatedUser = await User.findById(user._id).populate('currentOrganization', 'name');

//         res.json({
//             _id: finalUpdatedUser._id,
//             firstName: finalUpdatedUser.firstName,
//             lastName: finalUpdatedUser.lastName,
//             email: finalUpdatedUser.email,
//             currentOrganization: finalUpdatedUser.currentOrganization,
//             preferences: finalUpdatedUser.preferences,
//             mfaEnabled: finalUpdatedUser.mfaEnabled
//         });

//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });


// // @desc    Enable or disable MFA for a user
// // @route   PUT /api/v1/users/:id/mfa-toggle
// // @access  Private
// const toggleMfaStatus = asyncHandler(async (req, res) => {
//     const { mfaEnabled, password } = req.body;

//     if (req.user._id.toString() !== req.params.id) {
//         res.status(401);
//         throw new Error('Not authorized to update this user');
//     }
    
//     const user = await User.findById(req.user._id);

//     if (!password || !(await user.matchPassword(password))) {
//         res.status(401);
//         throw new Error('Incorrect password.');
//     }

//     if (typeof mfaEnabled !== 'boolean') {
//         res.status(400);
//         throw new Error('Invalid value for mfaEnabled.');
//     }

//     user.mfaEnabled = mfaEnabled;
//     await user.save();

//     res.status(200).json({
//         success: true,
//         message: `Two-Factor Authentication has been ${mfaEnabled ? 'enabled' : 'disabled'}.`,
//         mfaEnabled: user.mfaEnabled
//     });
// });


// // @desc    Delete user
// // @route   DELETE /api/v1/users/:id
// // @access  Private/Admin
// const deleteUser = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.params.id);

//     if (user) {
//         // Add logic to ensure user is an admin or the user themselves
//         await user.remove();
//         res.json({ message: 'User removed' });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// // @desc      Update user avatar
// // @route     PUT /api/v1/users/me/avatar
// // @access    Private
// const updateUserAvatar = asyncHandler(async (req, res) => {
//   const { public_id, url } = req.body;

//   if (!public_id || !url) {
//     res.status(400);
//     throw new Error('Please provide public_id and url');
//   }

//   const user = await User.findById(req.user._id);

//   if (user) {
//     // Check if the user already has an avatar and delete the old one
//     if (user.avatar && user.avatar.public_id) {
//       await deleteFromCloudinary(user.avatar.public_id);
//     }

//     // Update with the new avatar info
//     user.avatar = { public_id, url };
//     await user.save();
    
//     res.status(200).json({
//       message: 'Avatar updated successfully',
//       avatar: user.avatar,
//     });
//   } else {
//     res.status(404);
//     throw new Error('User not found');
//   }
// });


// module.exports = { 
// getUsers,
//  getUserById,
//  updateUser,
//  toggleMfaStatus,
//  deleteUser,
//  updateUserAvatar
//  };










const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { deleteFromCloudinary } = require('../utils/cloudinary');

const getUsers = asyncHandler(async (req, res) => {
    // This route should be protected by the superAdmin middleware in your userRoutes.js
    const users = await User.find({}).populate('organizations', 'name');
    res.json(users);
});

const getUserById = asyncHandler(async (req, res) => {
    // This route should also be protected by the superAdmin middleware
    const user = await User.findById(req.params.id).select('-passwordHash').populate('organizations', 'name');
    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // ✨ Authorization Check: Allow if user is a superadmin OR is updating their own profile.
        if (req.user.role !== 'superadmin' && req.user._id.toString() !== user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to update this user');
        }

        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        
        if (req.body.preferences) {
            user.preferences = { ...user.preferences, ...req.body.preferences };
        }

        await user.save();
        const finalUpdatedUser = await User.findById(user._id).populate('currentOrganization', 'name');

        res.json({
            _id: finalUpdatedUser._id,
            firstName: finalUpdatedUser.firstName,
            lastName: finalUpdatedUser.lastName,
            email: finalUpdatedUser.email,
            currentOrganization: finalUpdatedUser.currentOrganization,
            preferences: finalUpdatedUser.preferences,
            mfaEnabled: finalUpdatedUser.mfaEnabled,
            mfaMethod: finalUpdatedUser.mfaMethod,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // ✨ Authorization Check: Allow if user is a superadmin OR is deleting their own profile.
        if (req.user.role !== 'superadmin' && req.user._id.toString() !== user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to delete this user');
        }

        await user.remove(); // The pre('remove') hook will handle avatar cleanup
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const { public_id, url } = req.body;
    if (!public_id || !url) {
        res.status(400);
        throw new Error('Please provide public_id and url');
    }

    const user = await User.findById(req.user._id);
    if (user) {
        // This implicitly only allows a user to update their own avatar, which is correct.
        if (user.avatar && user.avatar.public_id) {
            await deleteFromCloudinary(user.avatar.public_id);
        }
        user.avatar = { public_id, url };
        await user.save();
        
        res.status(200).json({
            message: 'Avatar updated successfully',
            avatar: user.avatar,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    updateUserAvatar
};