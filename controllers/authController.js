// const asyncHandler = require('express-async-handler');
// const { OAuth2Client } = require('google-auth-library');
// const User = require('../models/User');
// const Organization = require('../models/Organization');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const sendEmail = require('../utils/email/sendEmail');

// // Initialize Google Auth Client
// const googleClient = new OAuth2Client(process.env.PRAXFORM_GOOGLE_CLIENT_ID);

// // Helper function to generate a 6-digit numeric code
// const generateSixDigitCode = () => {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// };

// // Helper function to parse expiration time from string (e.g., "7d", "15m")
// const parseExpiry = (expiryString) => {
//     if (!expiryString) return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
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

// // @desc        Helper to send token response
// const sendTokenResponse = async (user, statusCode, res) => {
//     const { accessToken, refreshToken } = generateTokens(user._id);
//     const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name');

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
//         },
//         accessToken,
//     });
// };


// // @desc      Register a new user
// // @route     POST /api/v1/auth/register
// // @access    Public
// const registerUser = asyncHandler(async (req, res) => {
//     const { firstName, lastName, email, password, organization, role } = req.body;

//     if (!email || !password || !firstName || !lastName || !organization || !organization.name || !organization.industry) {
//         res.status(400);
//         throw new Error('Please provide all required user (firstName, lastName, email, password) and organization (name, industry) fields.');
//     }

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

//     const userRole = role || 'user';
//     if (userRole !== 'user' && userRole !== 'admin') {
//         res.status(400);
//         throw new Error('Invalid role specified. Role must be "user" or "admin".');
//     }

//     const newOrganization = await Organization.create({
//         name: organization.name,
//         slug: organization.name.toLowerCase().replace(/\s+/g, '-'),
//         industry: organization.industry
//     });

//     const verificationCode = generateSixDigitCode();
//     const emailVerificationCodeHashed = crypto.createHash('sha256').update(verificationCode).digest('hex');
//     const emailVerificationCodeExpires = Date.now() + 3600000;

//     const user = await User.create({
//         firstName,
//         lastName,
//         email,
//         passwordHash: password,
//         organizations: [newOrganization._id],
//         currentOrganization: newOrganization._id,
//         role: userRole,
//         authMethod: 'local',
//         isEmailVerified: false,
//         emailVerificationToken: emailVerificationCodeHashed,
//         emailVerificationTokenExpires: emailVerificationCodeExpires
//     });

//     newOrganization.members.push({ userId: user._id, role: 'owner' });
//     await newOrganization.save();

//     const subject = "Verify Your Email for PraxForm";
//     const send_to = user.email;
//     const sent_from = `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`;
//     const reply_to = process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com';
//     const template = "verification";
//     const name = user.firstName;
//     const code = verificationCode;

//     try {
//         await sendEmail({ subject, send_to, sent_from, reply_to, template, name, code });
//         const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name');

//         return res.status(201).json({
//             success: true,
//             _id: populatedUser._id,
//             firstName: populatedUser.firstName,
//             lastName: populatedUser.lastName,
//             email: populatedUser.email,
//             currentOrganization: populatedUser.currentOrganization,
//             message: 'User registered successfully. Please check your email for the verification code.'
//         });
//     } catch (emailError) {
//         console.error('Error sending verification email:', emailError);
//         user.emailVerificationToken = undefined;
//         user.emailVerificationTokenExpires = undefined;
//         await user.save();
//         return res.status(500).json({
//             success: false,
//             message: 'User registered but failed to send verification email. Please try resending verification later.'
//         });
//     }
// });

// // @desc      Auth user & get token
// // @route     POST /api/v1/auth/login
// // @access    Public
// const loginUser = asyncHandler(async (req, res) => {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });

//     if (user && (await user.matchPassword(password))) {
//         await sendTokenResponse(user, 200, res);
//     } else {
//         res.status(401);
//         throw new Error('Invalid email or password');
//     }
// });

// // @desc      Authenticate with Google
// // @route     POST /api/v1/auth/google
// // @access    Public
// const googleAuth = asyncHandler(async (req, res) => {
//     const { token } = req.body;
//     if (!token) {
//         res.status(400);
//         throw new Error("Google token is required");
//     }

//     const ticket = await googleClient.verifyIdToken({
//         idToken: token,
//         audience: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
//     });
//     const { name, email, given_name, family_name } = ticket.getPayload();

//     let user = await User.findOne({ email });

//     if (user) {
//         // User exists, log them in
//         if (user.authMethod !== 'google') {
//             res.status(400);
//             throw new Error(`This email is registered with a different method. Please use ${user.authMethod} to log in.`);
//         }
//         await sendTokenResponse(user, 200, res);
//     } else {
//         // User does not exist, create a new user and organization
//         const organizationName = `${given_name}'s Organization`;
//         const newOrganization = await Organization.create({
//             name: organizationName,
//             slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
//             industry: "Other" // Default industry
//         });
        
//         const newUser = await User.create({
//             firstName: given_name,
//             lastName: family_name || ' ',
//             email,
//             authMethod: 'google',
//             isEmailVerified: true,
//             organizations: [newOrganization._id],
//             currentOrganization: newOrganization._id,
//         });
        
//         newOrganization.members.push({ userId: newUser._id, role: 'owner' });
//         await newOrganization.save();

//         await sendTokenResponse(newUser, 201, res);
//     }
// });

// // @desc      Request a login code
// // @route     POST /api/v1/auth/request-code
// // @access    Public
// const requestLoginCode = asyncHandler(async (req, res) => {
//     const { email } = req.body;
//     if (!email) {
//         res.status(400);
//         throw new Error("Please provide an email.");
//     }

//     const user = await User.findOne({ email });
//     // To prevent user enumeration, always return a success message.
//     // Only send an email if the user actually exists.
//     if (user) {
//         const loginCode = generateSixDigitCode();
//         user.loginCode = crypto.createHash('sha256').update(loginCode).digest('hex');
//         user.loginCodeExpires = Date.now() + 600000; // 10 minute expiry

//         await user.save();

//         // Send email with the code
//         try {
//             await sendEmail({
//                 subject: 'Your PraxForm Login Code',
//                 send_to: user.email,
//                 sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//                 reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//                 template: 'login-code',
//                 name: user.firstName,
//                 code: loginCode
//             });
//         } catch (err) {
//             console.error('Error sending login code email:', err);
//         }
//     }
    
//     res.status(200).json({
//         success: true,
//         message: 'If an account with that email exists, a login code has been sent.'
//     });
// });

// // @desc      Login with a one-time code
// // @route     POST /api/v1/auth/login-code
// // @access    Public
// const loginWithCode = asyncHandler(async (req, res) => {
//     const { email, code } = req.body;
//     if (!email || !code) {
//         res.status(400);
//         throw new Error("Please provide an email and your login code.");
//     }
    
//     const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

//     const user = await User.findOne({
//         email,
//         loginCode: hashedCode,
//         loginCodeExpires: { $gt: Date.now() }
//     });
    
//     if (!user) {
//         res.status(401);
//         throw new Error("Invalid or expired login code.");
//     }
    
//     // Clear the code after successful use
//     user.loginCode = undefined;
//     user.loginCodeExpires = undefined;
//     await user.save();
    
//     await sendTokenResponse(user, 200, res);
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
//             throw new Error('Invalid token user');
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
// // @route     GET /api/v1/auth/logout
// // @access    Private
// const logout = asyncHandler(async (req, res) => {
//     res.cookie('refreshToken', 'none', {
//         expires: new Date(Date.now() + 10 * 1000),
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         path: '/api/v1/auth/refresh-token'
//     });

//     res.status(200).json({
//         success: true,
//         message: 'User logged out successfully'
//     });
// });

// // @desc      Get user profile
// // @route     GET /api/v1/auth/me
// // @access    Private
// const getMe = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user._id).populate('currentOrganization', 'name');

//     if (user) {
//         res.json({
//             _id: user._id,
//             firstName: user.firstName,
//             lastName: user.lastName,
//             email: user.email,
//             currentOrganization: user.currentOrganization,
//         });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// // @desc      Resend email verification
// // @route     POST /api/v1/auth/resendverification
// // @access    Public
// const resendVerification = asyncHandler(async (req, res) => {
//     const { email } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//         res.status(404);
//         throw new Error('User not found');
//     }

//     if (user.isEmailVerified) {
//         res.status(400).json({ message: 'Email already verified' });
//         return;
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
//         res.json({ success: true, message: 'Verification email with new code sent' });
//     } catch (err) {
//         console.error(err);
//         user.emailVerificationToken = undefined;
//         user.emailVerificationTokenExpires = undefined;
//         await user.save();
//         res.status(500);
//         throw new Error('Email could not be sent');
//     }
// });

// // @desc      Verify user email
// // @route     GET /api/v1/auth/verifyemail/:code
// // @access    Public
// const verifyEmail = asyncHandler(async (req, res) => {
//     const rawCode = req.params.code;

//     if (!rawCode) {
//         res.status(400);
//         throw new Error('Verification code not provided in the URL.');
//     }

//     const verificationCodeHashed = crypto.createHash('sha256').update(rawCode).digest('hex');

//     const user = await User.findOne({
//         emailVerificationToken: verificationCodeHashed,
//         emailVerificationTokenExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired verification code');
//     }

//     user.isEmailVerified = true;
//     user.emailVerificationToken = undefined;
//     user.emailVerificationTokenExpires = undefined;

//     await user.save();
    
//     try {
//         await sendEmail({
//             subject: "Welcome to PraxForm!",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "welcome",
//             name: user.firstName,
//             link: `${req.protocol}://${process.env.PRAXFORM_HOST}/dashboard`
//         });
//         console.log('Welcome email sent successfully.');
//     } catch (welcomeEmailError) {
//         console.error('Error sending welcome email:', welcomeEmailError);
//     }

//     res.status(200).json({ success: true, message: 'Email verified successfully. Welcome to PraxForm!' });
// });

// // @desc      Forgot password
// // @route     POST /api/v1/auth/forgotpassword
// // @access    Public
// const forgotPassword = asyncHandler(async (req, res) => {
//     const user = await User.findOne({ email: req.body.email });

//     if (!user) {
//         res.status(404);
//         throw new Error('User with that email not found');
//     }

//     const resetToken = crypto.randomBytes(20).toString('hex');
//     user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     user.resetPasswordExpires = Date.now() + 600000; // 10 minutes

//     await user.save();

//     const resetUrl = `${req.protocol}://${process.env.PRAXFORM_FRONTEND_HOST}/reset-password/${resetToken}`;

//     try {
//         await sendEmail({
//             subject: "Password Reset Request for PraxForm",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "reset-password",
//             name: user.firstName,
//             link: resetUrl
//         });
//         res.json({ success: true, message: 'Password reset link sent to your email. Please check your inbox.' });
//     } catch (err) {
//         console.error(err);
//         user.resetPasswordToken = undefined;
//         user.resetPasswordExpires = undefined;
//         await user.save();
//         res.status(500);
//         throw new Error('Email could not be sent');
//     }
// });

// // @desc      Reset password
// // @route     PUT /api/v1/auth/resetpassword/:token
// // @access    Public
// const resetPassword = asyncHandler(async (req, res) => {
//     const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');

//     const user = await User.findOne({
//         resetPasswordToken,
//         resetPasswordExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired token');
//     }
    
//     user.passwordHash = req.body.password;
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
//     await user.save();
    
//     await sendTokenResponse(user, 200, res);
// });

// // @desc      Change a logged-in user's password
// // @route     PUT /api/v1/auth/changepassword
// // @access    Private
// const changePassword = asyncHandler(async (req, res) => {
//     const { oldPassword, newPassword } = req.body;

//     if (!oldPassword || !newPassword) {
//         res.status(400);
//         throw new Error('Please provide both old and new passwords.');
//     }

//     const user = await User.findById(req.user._id);

//     if (!user) {
//         res.status(404);
//         throw new Error('User not found.');
//     }

//     if (!(await user.matchPassword(oldPassword))) {
//         res.status(401);
//         throw new Error('Incorrect old password.');
//     }

//     user.passwordHash = newPassword;
//     await user.save();

//     try {
//         await sendEmail({
//             subject: "Password Changed Successfully",
//             send_to: user.email,
//             sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//             reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
//             template: "changePassword",
//             name: user.firstName,
//             date: new Date().toLocaleString()
//         });
//         console.log('Password change confirmation email sent.');
//     } catch (emailError) {
//         console.error('Error sending password change confirmation email:', emailError);
//     }

//     res.status(200).json({ success: true, message: 'Password changed successfully.' });
// });

// module.exports = {
//     registerUser,
//     loginUser,
//     googleAuth,
//     requestLoginCode,
//     loginWithCode,
//     refreshToken,
//     getMe,
//     resendVerification,
//     verifyEmail,
//     forgotPassword,
//     resetPassword,
//     changePassword,
//     logout,
// };






const asyncHandler = require('express-async-handler');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/email/sendEmail');

// Correctly initialize the Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.PRAXFORM_GOOGLE_CLIENT_ID);

// Helper function to generate a 6-digit numeric code
const generateSixDigitCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to parse expiration time from string (e.g., "7d", "15m")
const parseExpiry = (expiryString) => {
    if (!expiryString) return 86400000; // Default to 1 day if undefined
    const num = parseInt(expiryString);
    const unit = expiryString.slice(-1);
    switch (unit) {
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'm': return num * 60 * 1000;
        case 's': return num * 1000;
        default: return num;
    }
};

// @desc      Generate access and refresh tokens
const generateTokens = (id) => {
    const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY
    });
    const refreshToken = jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY
    });
    return { accessToken, refreshToken };
};

// Helper to set the refresh token cookie and send the final response
const sendTokenResponse = async (user, statusCode, res) => {
    const { accessToken, refreshToken } = generateTokens(user._id);
    const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name');
    const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);
    const cookieOptions = {
        expires: new Date(Date.now() + cookieExpiryMs),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth/refresh-token'
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.status(statusCode).json({
        success: true,
        user: {
            _id: populatedUser._id,
            firstName: populatedUser.firstName,
            lastName: populatedUser.lastName,
            email: populatedUser.email,
            currentOrganization: populatedUser.currentOrganization,
        },
        accessToken,
    });
};


// @desc      Register a new user
// @route     POST /api/v1/auth/register
// @access    Public
const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, organization, role } = req.body;

    if (!email || !password || !firstName || !lastName || !organization || !organization.name || !organization.industry) {
        res.status(400);
        throw new Error('Please provide all required user (firstName, lastName, email, password) and organization (name, industry) fields.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Invalid email format.');
    }

    const passwordRulesRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRulesRegex.test(password)) {
        res.status(400);
        throw new Error('Password must be at least 8 characters long, contain at least one number and one special character.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    const newOrganization = await Organization.create({
        name: organization.name,
        slug: organization.name.toLowerCase().replace(/\s+/g, '-'),
        industry: organization.industry
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
        emailVerificationTokenExpires: Date.now() + 3600000 // 1 hour
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


// @desc      Authenticate user & get token (MFA Step 1)
// @route     POST /api/v1/auth/login
// @access    Public
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
        user.loginCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        try {
            await sendEmail({
                subject: "Your PraxForm Login Code",
                send_to: user.email,
                sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
                reply_to: process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com',
                template: "login-code",
                name: user.firstName,
                code: code
            });
            res.status(200).json({
                success: true,
                mfaRequired: true,
                message: 'Please check your email for a login code.'
            });
        } catch (emailError) {
            console.error('Error sending MFA email:', emailError);
            res.status(500);
            throw new Error('Could not send login code. Please try again later.');
        }
    } else {
        await sendTokenResponse(user, 200, res);
    }
});

// @desc      Verify MFA code and complete login (MFA Step 2)
// @route     POST /api/v1/auth/verify-mfa
// @access    Public
const verifyMfa = asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        res.status(400);
        throw new Error('Please provide an email and your login code.');
    }

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
    await user.save();

    await sendTokenResponse(user, 200, res);
});


// @desc      Authenticate with Google
// @route     POST /api/v1/auth/google
// @access    Public
const googleAuth = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        res.status(400);
        throw new Error("Google token is required");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
    });
    const { name, email, given_name, family_name } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (user) {
        // User exists, log them in
        if (user.authMethod !== 'google') {
            res.status(400);
            throw new Error(`This email is registered with a different method. Please use ${user.authMethod} to log in.`);
        }
        await sendTokenResponse(user, 200, res);
    } else {
        // User does not exist, create a new user and organization
        const organizationName = `${given_name}'s Organization`;
        const newOrganization = await Organization.create({
            name: organizationName,
            slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
            industry: "Other" // Default industry
        });
        
        const newUser = await User.create({
            firstName: given_name,
            lastName: family_name || ' ',
            email,
            authMethod: 'google',
            isEmailVerified: true,
            organizations: [newOrganization._id],
            currentOrganization: newOrganization._id,
        });
        
        newOrganization.members.push({ userId: newUser._id, role: 'owner' });
        await newOrganization.save();

        await sendTokenResponse(newUser, 201, res);
    }
});


// @desc      Refresh access token
// @route     POST /api/v1/auth/refresh-token
// @access    Public
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

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
        const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);
        const cookieOptions = {
            expires: new Date(Date.now() + cookieExpiryMs),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/v1/auth/refresh-token'
        };

        res.cookie('refreshToken', newRefreshToken, cookieOptions);
        res.json({ success: true, accessToken });
    } catch (err) {
        res.status(401);
        throw new Error('Refresh token invalid or expired. Please log in again.');
    }
});

// @desc      Logout user
// @route     POST /api/v1/auth/logout
// @access    Private
const logout = asyncHandler(async (req, res) => {
    res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // 10 seconds
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth/refresh-token'
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc      Get current logged in user
// @route     GET /api/v1/auth/me
// @access    Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate('currentOrganization', 'name');
    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currentOrganization: user.currentOrganization,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc      Resend email verification code
// @route     POST /api/v1/auth/resend-verification
// @access    Public
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
        await sendEmail({ /* ... email details ... */ });
        res.json({ success: true, message: 'New verification email sent.' });
    } catch (err) {
        res.status(500);
        throw new Error('Email could not be sent.');
    }
});

// @desc      Verify user email
// @route     GET /api/v1/auth/verifyemail/:code
// @access    Public
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
    
    // Optional: Send welcome email
    
    res.status(200).json({ success: true, message: 'Email verified successfully.' });
});

// @desc      Forgot password
// @route     POST /api/v1/auth/forgot-password
// @access    Public
const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/reset-password/${resetToken}`;
    try {
        await sendEmail({
            subject: "Password Reset Request",
            send_to: user.email,
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

// @desc      Reset password
// @route     PUT /api/v1/auth/reset-password/:token
// @access    Public
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

// @desc      Change password for a logged-in user
// @route     PUT /api/v1/auth/change-password
// @access    Private
const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !(await user.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Incorrect old password.');
    }

    user.passwordHash = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
});

module.exports = {
    registerUser,
    loginUser,
    verifyMfa,
    googleAuth,
    refreshToken,
    logout,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword
};
