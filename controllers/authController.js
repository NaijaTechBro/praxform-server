// const asyncHandler = require('express-async-handler');
// const { OAuth2Client } = require('google-auth-library');
// const User = require('../models/User');
// const Organization = require('../models/Organization');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const createNotification = require('../utils/createNotification');
// const sendEmail = require('../utils/email/sendEmail');

// const googleClient = new OAuth2Client(
//     process.env.PRAXFORM_GOOGLE_CLIENT_ID,
//     process.env.PRAXFORM_GOOGLE_CLIENT_SECRET,
//     process.env.PRAXFORM_GOOGLE_REDIRECT_URI
// );

// // Helper function to generate a 6-digit numeric code
// const generateSixDigitCode = () => {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// };

// // Helper function to parse expiration time from string (e.g., "7d", "15m")
// const parseExpiry = (expiryString) => {
//     if (!expiryString) return 86400000; 
//     const num = parseInt(expiryString);
//     const unit = expiryString.slice(-1);
//     switch (unit) {
//         case 'd': return num * 24 * 60 * 60 * 1000;
//         case 'h': return num * 60 * 60 * 1000;
//         case 'm': return num * 60 * 1000;
//         case 's': return num * 1000;
//         default: return num;
//     }
// };

// // @desc      Generate access and refresh tokens
// const generateTokens = (id) => {
//     const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
//         expiresIn: process.env.JWT_ACCESS_EXPIRY
//     });
//     const refreshToken = jwt.sign({ id }, process.env.JWT_SECRET, {
//         expiresIn: process.env.JWT_REFRESH_EXPIRY
//     });
//     return { accessToken, refreshToken };
// };

// // Helper to set the refresh token cookie and send the final response
// const sendTokenResponse = async (user, statusCode, res) => {
//     const { accessToken, refreshToken } = generateTokens(user._id);
//     const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name logo');
//     const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);
//     const cookieOptions = {
//         expires: new Date(Date.now() + cookieExpiryMs),
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         path: '/api/v1/auth/refresh-token'
//     };
//     res.cookie('refreshToken', refreshToken, cookieOptions);
//     res.status(statusCode).json({
//         success: true,
//         user: {
//             _id: populatedUser._id,
//             firstName: populatedUser.firstName,
//             lastName: populatedUser.lastName,
//             email: populatedUser.email,
//             currentOrganization: populatedUser.currentOrganization,
//             avatar: populatedUser.avatar,
//             preferences: populatedUser.preferences,
//             mfaEnabled: populatedUser.mfaEnabled,

//         },
//         accessToken,
//     });
// };


// // @desc      Register a new user
// // @route     POST /api/v1/auth/register
// // @access    Public
// const registerUser = asyncHandler(async (req, res) => {
//     const { firstName, lastName, email, password, organization, role } = req.body;

//     if (!email || !password || !firstName || !lastName || !organization || !organization.name || !organization.industry || !organization.address || !organization.phoneNumber || !organization.website ) {
//         res.status(400);
//         throw new Error('Please provide all required user and organization fields, including address, phone, and website.');
//       }

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//         res.status(400);
//         throw new Error('Invalid email format.');
//     }

//     const passwordRulesRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
//     if (!passwordRulesRegex.test(password)) {
//         res.status(400);
//         throw new Error('Password must be at least 8 characters long, contain at least one number and one special character.');
//     }

//     const userExists = await User.findOne({ email });
//     if (userExists) {
//         res.status(400);
//         throw new Error('User with this email already exists.');
//     }

//     // --- ROBUST & UNIQUE SLUG GENERATION ---
//     const generateUniqueSlug = async (name) => {
//         const baseSlug = name.toLowerCase()
//                              .replace(/\s+/g, '-') 
//                              .replace(/[^\w\-]+/g, ''); 
//         let slug = baseSlug;
//         let counter = 1;
//         // Append number if slug already exists
//         while (await Organization.findOne({ slug })) {
//             slug = `${baseSlug}-${counter}`;
//             counter++;
//         }
//         return slug;
//     };

//     const uniqueSlug = await generateUniqueSlug(organization.name);
    
//     const newOrganization = await Organization.create({
//         name: organization.name,
//         slug: uniqueSlug,
//         industry: organization.industry,
//         address: organization.address,
//         phoneNumber: organization.phoneNumber,
//         website: organization.website,
//         email: email,
//     });

//     const verificationCode = generateSixDigitCode();
//     const emailVerificationCodeHashed = crypto.createHash('sha256').update(verificationCode).digest('hex');

//     const user = await User.create({
//         firstName,
//         lastName,
//         email,
//         passwordHash: password,
//         organizations: [newOrganization._id],
//         currentOrganization: newOrganization._id,
//         authMethod: 'local',
//         emailVerificationToken: emailVerificationCodeHashed,
//         emailVerificationTokenExpires: Date.now() + 3600000 // 1 hour
//     });

//     newOrganization.members.push({ userId: user._id, role: 'owner' });
//     await newOrganization.save();

//     try {
//         await sendEmail({
//             subject: "Verify Your Email for PraxForm",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "verification",
//             name: user.firstName,
//             code: verificationCode
//         });

//         res.status(201).json({
//             success: true,
//             message: 'User registered successfully. Please check your email for the verification code.'
//         });
//     } catch (emailError) {
//         console.error('Error sending verification email:', emailError);
//         res.status(500);
//         throw new Error('User registered but failed to send verification email.');
//     }
// });

// // @desc      Authenticate user & get token
// // @route     POST /api/v1/auth/login
// // @access    Public
// const loginUser = asyncHandler(async (req, res) => {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });

//     if (!user || !(await user.matchPassword(password))) {
//         res.status(401);
//         throw new Error('Invalid email or password');
//     }
    
//     if (user.authMethod !== 'local') {
//         res.status(401);
//         throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
//     }

//     if (!user.isEmailVerified) {
//         res.status(401);
//         throw new Error('Please verify your email address before logging in.');
//     }

//     // Check if MFA is actually enabled for this user
//     if (user.mfaEnabled) {
//         // --- MFA-ENABLED FLOW ---
//         const code = generateSixDigitCode();
//         user.loginCode = crypto.createHash('sha256').update(code).digest('hex');
//         user.loginCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
//         await user.save();

//         try {
//             await sendEmail({
//                 subject: "Your PraxForm Login Code",
//                 send_to: user.email,
//                 sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//                 reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//                 template: "login-code",
//                 name: user.firstName,
//                 code: code
//             });
//             res.status(200).json({
//                 success: true,
//                 mfaRequired: true,
//                 message: 'MFA is enabled. Please check your email for a login code.'
//             });
//         } catch (emailError) {
//             console.error('Error sending MFA email:', emailError);
//             res.status(500);
//             throw new Error('Could not send login code. Please try again later.');
//         }
//     } else {
//         // Update the last login timestamp
//         user.lastLogin = new Date();
//         await user.save();
        
//         // Send access tokens and log the user in directly
//         await sendTokenResponse(user, 200, res);
//     }
// });


// // @desc      Verify MFA code and complete login (MFA Step 2)
// // @route     POST /api/v1/auth/verify-mfa
// // @access    Public
// const verifyMfa = asyncHandler(async (req, res) => {
//     const { email, code } = req.body;

//     if (!email || !code) {
//         res.status(400);
//         throw new Error('Please provide an email and your login code.');
//     }

//     const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

//     const user = await User.findOne({
//         email,
//         loginCode: hashedCode,
//         loginCodeExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//         res.status(401);
//         throw new Error('Invalid or expired login code.');
//     }

//     user.loginCode = undefined;
//     user.loginCodeExpires = undefined;
//     user.lastLogin = new Date();
//     await user.save();

//     await sendTokenResponse(user, 200, res);
// });


// // @desc      Handle Google OAuth callback and token issuance
// // @route     GET /api/v1/auth/google/callback
// // @access    Public
// const googleAuthCallback = asyncHandler(async (req, res) => {
//     const user = req.user;

//     if (user.currentOrganization) {
//         user.lastLogin = new Date();
//         await user.save();
//         await sendTokenResponse(user, 200, res);
//         return;
//     }

//     const setupToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
//         expiresIn: '15m' 
//     });

//     const redirectUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/auth/setup-organization?setup_token=${setupToken}`;
    
//     res.redirect(redirectUrl);
// });

// // @desc      Refresh access token
// // @route     POST /api/v1/auth/refresh-token
// // @access    Public
// const refreshToken = asyncHandler(async (req, res) => {
//     const { refreshToken: tokenFromCookie } = req.cookies;

//     if (!tokenFromCookie) {
//         res.status(401);
//         throw new Error('No refresh token provided.');
//     }

//     try {
//         const decoded = jwt.verify(tokenFromCookie, process.env.JWT_SECRET);
//         const user = await User.findById(decoded.id);

//         if (!user) {
//             res.status(401);
//             throw new Error('Invalid token user.');
//         }

//         const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
//         const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);
//         const cookieOptions = {
//             expires: new Date(Date.now() + cookieExpiryMs),
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'strict',
//             path: '/api/v1/auth/refresh-token'
//         };

//         res.cookie('refreshToken', newRefreshToken, cookieOptions);
//         res.json({ success: true, accessToken });
//     } catch (err) {
//         res.status(401);
//         throw new Error('Refresh token invalid or expired. Please log in again.');
//     }
// });

// // @desc      Logout user
// // @route     POST /api/v1/auth/logout
// // @access    Private
// const logout = asyncHandler(async (req, res) => {
//     res.cookie('refreshToken', 'none', {
//         expires: new Date(Date.now() + 10 * 1000), // 10 seconds
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         path: '/api/v1/auth/refresh-token'
//     });
//     res.status(200).json({ success: true, message: 'Logged out successfully' });
// });

// // @desc      Get current logged in user
// // @route     GET /api/v1/auth/me
// // @access    Private
// const getMe = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user._id).populate('currentOrganization', 'name logo');
//     if (user) {
//         res.json({
//             _id: user._id,
//             firstName: user.firstName,
//             lastName: user.lastName,
//             email: user.email,
//             currentOrganization: user.currentOrganization,
//             preferences: user.preferences,
//             mfaEnabled: user.mfaEnabled,
//             avatar: user.avatar
//         });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// // @desc      Resend email verification code
// // @route     POST /api/v1/auth/resend-verification
// // @access    Public
// const resendVerification = asyncHandler(async (req, res) => {
//     const { email } = req.body;
//     const user = await User.findOne({ email });

//     if (!user) {
//         res.status(404);
//         throw new Error('User not found.');
//     }
//     if (user.isEmailVerified) {
//         res.status(400);
//         throw new Error('Email is already verified.');
//     }

//     const verificationCode = generateSixDigitCode();
//     user.emailVerificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
//     user.emailVerificationTokenExpires = Date.now() + 3600000;
//     await user.save();

//     try {
//         await sendEmail({
//             subject: "Verify Your Email for PraxForm",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "verification",
//             name: user.firstName,
//             code: verificationCode
//         });
//         res.json({ success: true, message: 'New verification email sent.' });
//     } catch (err) {
//         res.status(500);
//         throw new Error('Email could not be sent.');
//     }
// });

// // @desc      Verify user email
// // @route     GET /api/v1/auth/verifyemail/:code
// // @access    Public
// const verifyEmail = asyncHandler(async (req, res) => {
//     const verificationCodeHashed = crypto.createHash('sha256').update(req.params.code).digest('hex');
//     const user = await User.findOne({
//         emailVerificationToken: verificationCodeHashed,
//         emailVerificationTokenExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired verification code.');
//     }

//     user.isEmailVerified = true;
//     user.emailVerificationToken = undefined;
//     user.emailVerificationTokenExpires = undefined;
//     await user.save();
    
//     res.status(200).json({ success: true, message: 'Email verified successfully.' });
// });

// // @desc      Forgot password
// // @route     POST /api/v1/auth/forgot-password
// // @access    Public
// const forgotPassword = asyncHandler(async (req, res) => {
//     const user = await User.findOne({ email: req.body.email });
//     if (!user) {
//         res.status(404);
//         throw new Error('User not found.');
//     }

//       // Ensure user has a local password before sending a reset link
//     if (user.authMethod !== 'local') {
//         res.status(400);
//         throw new Error(`This account is managed by ${user.authMethod}. Password cannot be reset here.`);
//     }
    
//     const resetToken = crypto.randomBytes(20).toString('hex');
//     user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     user.resetPasswordExpires = Date.now() + 3600000;
//     await user.save();

//     const resetUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/reset-password/${resetToken}`;
//     try {
//         await sendEmail({
//             subject: "Password Reset Request",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "reset-password",
//             name: user.firstName,
//             link: resetUrl
//         });
//         res.json({ success: true, message: 'Password reset link sent.' });
//     } catch (err) {
//         user.resetPasswordToken = undefined;
//         user.resetPasswordExpires = undefined;
//         await user.save();
//         res.status(500);
//         throw new Error('Email could not be sent.');
//     }
// });

// // @desc      Reset password
// // @route     PUT /api/v1/auth/reset-password/:token
// // @access    Public
// const resetPassword = asyncHandler(async (req, res) => {
//     const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');
//     const user = await User.findOne({
//         resetPasswordToken,
//         resetPasswordExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired token.');
//     }

//     user.passwordHash = req.body.password;
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
//     await user.save();

//     await sendTokenResponse(user, 200, res);
// });

// // @desc      Change password for a logged-in user
// // @route     PUT /api/v1/auth/change-password
// // @access    Private
// const changePassword = asyncHandler(async (req, res) => {
//     const { oldPassword, newPassword } = req.body;
//     const user = await User.findById(req.user._id);

//     if (!user || !(await user.matchPassword(oldPassword))) {
//         res.status(401);
//         throw new Error('Incorrect old password.');
//     }
    
//     // Add validation for the new password
//     const passwordRulesRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
//     if (!passwordRulesRegex.test(newPassword)) {
//         res.status(400);
//         throw new Error('New password must be at least 8 characters long, contain at least one number and one special character.');
//     }

//     user.passwordHash = newPassword;
//     await user.save();

//     const message = "Your account password was successfully changed.";
//     await createNotification(user._id, user.currentOrganization, 'password_changed', message, '/settings/security');

//     // Send an email notification to the user
//     try {
//         await sendEmail({
//             subject: "Your PraxForm Password Has Been Changed",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "changePassword",
//             name: user.firstName,
//         });
//     } catch (emailError) {
//         console.error('Error sending password change notification email:', emailError);
//     }
    
//     res.status(200).json({ success: true, message: 'Password changed successfully.' });
// });



// module.exports = {
//     registerUser,
//     loginUser,
//     verifyMfa,
//     googleAuthCallback,
//     refreshToken,
//     logout,
//     getMe,
//     resendVerification,
//     verifyEmail,
//     forgotPassword,
//     resetPassword,
//     changePassword
// };



























const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const createNotification = require('../utils/createNotification');
const sendEmail = require('../utils/email/sendEmail');
const { sendTokenResponse } = require('../utils/tokenUtils');
const { generateTokens } = require('../utils/generateTokens');

const generateSixDigitCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, organization } = req.body;

    if (!email || !password || !firstName || !lastName || !organization || !organization.name || !organization.industry) {
        res.status(400);
        throw new Error('Please provide all required user and organization fields.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    const baseSlug = organization.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    const newOrganization = await Organization.create({
        name: organization.name,
        slug: slug,
        industry: organization.industry,
    });

    const verificationCode = generateSixDigitCode();
    const emailVerificationCodeHashed = crypto.createHash('sha256').update(verificationCode).digest('hex');

    const user = await User.create({
        firstName,
        lastName,
        email,
        passwordHash: password,
        organizations: [newOrganization._id],
        currentOrganization: newOrganization._id,
        authMethod: 'local',
        emailVerificationToken: emailVerificationCodeHashed,
        emailVerificationTokenExpires: Date.now() + 3600000
    });

    newOrganization.members.push({ userId: user._id, role: 'owner' });
    await newOrganization.save();

    try {
        await sendEmail({
            subject: "Verify Your Email for PraxForm",
            send_to: user.email,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
            template: "verification",
            name: user.firstName,
            code: verificationCode
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully. Please check your email for the verification code.'
        });
    } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        res.status(500);
        throw new Error('User registered but failed to send verification email.');
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    if (user.authMethod !== 'local') {
        res.status(401);
        throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
    }

    if (!user.isEmailVerified) {
        res.status(401);
        throw new Error('Please verify your email address before logging in.');
    }

    if (user.mfaEnabled) {
        const code = generateSixDigitCode();
        user.loginCode = crypto.createHash('sha256').update(code).digest('hex');
        user.loginCodeExpires = Date.now() + 600000;
        await user.save();

        // Logic to email the MFA code...
        res.status(200).json({
            success: true,
            mfaRequired: true,
            message: 'MFA is enabled. Please check your email for a login code.'
        });
    } else {
        user.lastLogin = new Date();
        await user.save();
        await sendTokenResponse(user, 200, res);
    }
});

const verifyMfa = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
        email,
        loginCode: hashedCode,
        loginCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(401);
        throw new Error('Invalid or expired login code.');
    }

    user.loginCode = undefined;
    user.loginCodeExpires = undefined;
    user.lastLogin = new Date();
    await user.save();
    await sendTokenResponse(user, 200, res);
});

const googleAuthCallback = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.currentOrganization) {
        user.lastLogin = new Date();
        await user.save();
        const { accessToken } = generateTokens(user._id);
        res.redirect(`${process.env.PRAXFORM_FRONTEND_HOST}/auth/google/callback?token=${accessToken}`);
    } else {
        const setupToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '15m'
        });
        const redirectUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/auth/setup-organization?setup_token=${setupToken}`;
        res.redirect(redirectUrl);
    }
});

const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken: tokenFromCookie } = req.cookies;
    if (!tokenFromCookie) {
        res.status(401);
        throw new Error('No refresh token provided.');
    }
    try {
        const decoded = jwt.verify(tokenFromCookie, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            res.status(401);
            throw new Error('Invalid token user.');
        }
        const { accessToken } = generateTokens(user._id);
        res.json({ success: true, accessToken });
    } catch (err) {
        res.status(401);
        throw new Error('Refresh token invalid or expired. Please log in again.');
    }
});

const logout = asyncHandler(async (req, res) => {
    res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth/refresh-token'
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate('currentOrganization', 'name logo');
    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currentOrganization: user.currentOrganization,
            preferences: user.preferences,
            mfaEnabled: user.mfaEnabled,
            avatar: user.avatar
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc      Resend email verification code
// @route     POST /api/v1/auth/resend-verification
// @access    Public
const resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }
    if (user.isEmailVerified) {
        res.status(400);
        throw new Error('Email is already verified.');
    }

    const verificationCode = generateSixDigitCode();
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
    user.emailVerificationTokenExpires = Date.now() + 3600000;
    await user.save();

    try {
        await sendEmail({
            subject: "Verify Your Email for PraxForm",
            send_to: user.email,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
            template: "verification",
            name: user.firstName,
            code: verificationCode
        });
        res.json({ success: true, message: 'New verification email sent.' });
    } catch (err) {
        res.status(500);
        throw new Error('Email could not be sent.');
    }
});

// @desc      Verify user email
// @route     GET /api/v1/auth/verifyemail/:code
// @access    Public
const verifyEmail = asyncHandler(async (req, res) => {
    const verificationCodeHashed = crypto.createHash('sha256').update(req.params.code).digest('hex');
    const user = await User.findOne({
        emailVerificationToken: verificationCodeHashed,
        emailVerificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification code.');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();
    
    res.status(200).json({ success: true, message: 'Email verified successfully.' });
});

// @desc      Forgot password
// @route     POST /api/v1/auth/forgot-password
// @access    Public
const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

      // Ensure user has a local password before sending a reset link
    if (user.authMethod !== 'local') {
        res.status(400);
        throw new Error(`This account is managed by ${user.authMethod}. Password cannot be reset here.`);
    }
    
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/reset-password/${resetToken}`;
    try {
        await sendEmail({
            subject: "Password Reset Request",
            send_to: user.email,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
            template: "reset-password",
            name: user.firstName,
            link: resetUrl
        });
        res.json({ success: true, message: 'Password reset link sent.' });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent.');
    }
});

// @desc      Reset password
// @route     PUT /api/v1/auth/reset-password/:token
// @access    Public
const resetPassword = asyncHandler(async (req, res) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired token.');
    }

    user.passwordHash = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await sendTokenResponse(user, 200, res);
});

// @desc      Change password for a logged-in user
// @route     PUT /api/v1/auth/change-password
// @access    Private
const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !(await user.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Incorrect old password.');
    }
    
    // Add validation for the new password
    const passwordRulesRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRulesRegex.test(newPassword)) {
        res.status(400);
        throw new Error('New password must be at least 8 characters long, contain at least one number and one special character.');
    }

    user.passwordHash = newPassword;
    await user.save();

    const message = "Your account password was successfully changed.";
    await createNotification(user._id, user.currentOrganization, 'password_changed', message, '/settings/security');

    // Send an email notification to the user
    try {
        await sendEmail({
            subject: "Your PraxForm Password Has Been Changed",
            send_to: user.email,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
            template: "changePassword",
            name: user.firstName,
        });
    } catch (emailError) {
        console.error('Error sending password change notification email:', emailError);
    }
    
    res.status(200).json({ success: true, message: 'Password changed successfully.' });
});




module.exports = {
    registerUser,
    loginUser,
    verifyMfa,
    googleAuthCallback,
    refreshToken,
    logout,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword
};