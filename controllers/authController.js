const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const createNotification = require('../utils/createNotification');
const { sendEmail } = require('../utils/email/sendEmail');
const { generateTokens } = require('../utils/generateTokens');

// Constants for Security
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const generateSixDigitCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- CENTRALIZED TOKEN RESPONSE (Cookies + Redirects) ---
const sendTokenResponse = async (user, statusCode, res, redirectOverride) => {
    const { accessToken, refreshToken } = generateTokens(user._id);

    const cookieDomain = process.env.PRAXFORM_ROOT_DOMAIN || undefined;

    // Refresh Token: 7 Days, HTTP Only
    const refreshTokenOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        path: '/',
        domain: cookieDomain
    };

    // Access Token: 15 Mins, HTTP Only
    const accessTokenOptions = {
        expires: new Date(Date.now() + 15 * 60 * 1000),
        httpOnly: true,
        path: '/',
        domain: cookieDomain
    };

    if (process.env.NODE_ENV === 'production') {
        refreshTokenOptions.secure = true;
        refreshTokenOptions.sameSite = 'none';
        accessTokenOptions.secure = true;
        accessTokenOptions.sameSite = 'none';
    } else {
        refreshTokenOptions.sameSite = 'lax';
        accessTokenOptions.sameSite = 'lax';
    }

    res.cookie('refreshToken', refreshToken, refreshTokenOptions);
    res.cookie('accessToken', accessToken, accessTokenOptions);

    // --- Redirect Logic (For Google Auth) ---
    if (statusCode === 302) {
        const frontendHost = process.env.PRAXFORM_FRONTEND_HOST || 'http://localhost:5173';
        
        // Priority 1: User has no organization (Needs Setup)
        if (!user.currentOrganization) {
            // Create a short-lived setup token for the frontend to authorize the setup wizard
            const setupToken = jwt.sign({ id: user._id, purpose: 'setup' }, process.env.JWT_SECRET, { expiresIn: '15m' });
            return res.redirect(`${frontendHost}/auth/google/callback?setup_token=${setupToken}`);
        }

        // Priority 2: Explicit Redirect Override (from state)
        if (redirectOverride) {
            return res.redirect(`${frontendHost}${redirectOverride}`);
        }

        // Priority 3: Default Dashboard
        return res.redirect(`${frontendHost}/dashboard`);
    }

    // --- JSON Logic (For Local Auth) ---
    res.status(statusCode).json({
        success: true,
        user: {
            _id: user._id,
            firstName: user.firstName,
            email: user.email,
            avatar: user.avatar,
            currentOrganization: user.currentOrganization
        },
        redirectPath: redirectOverride || '/dashboard' // Tell frontend where to go
    });
};

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, organization } = req.body;

    if (!email || !password || !firstName || !lastName || !organization) {
        res.status(400);
        throw new Error('Please provide all required fields.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    // Org Slug Logic
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
        website: organization.website,
        phoneNumber: organization.phoneNumber,
        address: organization.address,
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
            sent_from: `${process.env.PRAXFORM_FROM_NAME} <${process.env.PRAXFORM_FROM_EMAIL}>`,
            reply_to: process.env.PRAXFORM_FROM_EMAIL,
            template: "verification",
            name: user.firstName,
            code: verificationCode
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully. Please verify your email.'
        });
    } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        res.status(500); // Don't throw, user is created
        res.json({ success: true, message: 'User created, but email failed. Contact support.' });
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // Select password AND lockout fields
    const user = await User.findOne({ email }).select('+passwordHash +loginAttempts +lockUntil');

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    // 1. Check Account Lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
        res.status(423); // Locked
        const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
        throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
    }

    // 2. Check Password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        // Increment attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = new Date(Date.now() + LOCK_TIME);
            user.loginAttempts = 0; // Reset count so it starts fresh after lock expires
            await user.save();
            res.status(423);
            throw new Error(`Too many failed attempts. Account locked for 15 minutes.`);
        }
        
        await user.save();
        res.status(401);
        throw new Error('Invalid email or password');
    }

    // 3. Success - Reset Lockout
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // 4. Check Auth Method (Hybrid Logic allow 'google' users to use password if they set one, 
    // but strictly speaking for Praxform, we might want to enforce 'local' match or allow both if merged)
    // For now, let's allow it if the password matched.

    // 5. Check Email Verification
    if (!user.isEmailVerified) {
        res.status(403);
        throw new Error('Please verify your email address before logging in.');
    }

    // 6. MFA Check (Praxform Specific)
    if (user.mfaEnabled) {
        return res.status(200).json({
            success: true,
            mfaRequired: true,
            mfaMethod: user.mfaMethod,
            message: 'MFA is enabled. Please provide your authentication code.'
        });
    }

    user.lastLogin = new Date();
    await user.save();

    // 7. Send Token Response
    await sendTokenResponse(user, 200, res);
});

const verifyMfa = asyncHandler(async (req, res) => {
    const { email, code, mfaToken } = req.body;
    let user;

    if (mfaToken) {
        const decoded = jwt.verify(mfaToken, process.env.JWT_REAUTH_SECRET);
        if (decoded.purpose !== 'mfa-verification') {
            res.status(401); throw new Error('Invalid MFA token purpose.');
        }
        user = await User.findById(decoded.id).select('+googleAuthenticatorSecret');
    } else if (email) {
        user = await User.findOne({ email }).select('+googleAuthenticatorSecret');
    }
        
    if (!user) {
        res.status(401); throw new Error('Invalid credentials');
    }

    let isValid = false;
    if (user.mfaMethod === 'app') {
        const speakeasy = require('speakeasy');
        isValid = speakeasy.totp.verify({
            secret: user.googleAuthenticatorSecret,
            encoding: 'base32',
            token: code,
            window: 1
        });
    } else { 
        // Logic for Email/SMS codes
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        const legacyUser = await User.findOne({
            _id: user._id,
            loginCode: hashedCode,
            loginCodeExpires: { $gt: Date.now() }
        });
        if (legacyUser) isValid = true;
    }

    if (!isValid) {
        res.status(401); throw new Error('Invalid code.');
    }

    user.lastLogin = new Date();
    await user.save();
    await sendTokenResponse(user, 200, res);
});

const googleAuthCallback = asyncHandler(async (req, res) => {
    const user = req.user;
    
    // The passport strategy already parsed the 'state' and attached 'postAuthPath' to req.user
    // But for MFA/Reauth, we need to check the query params again if we want to be specific
    
    // Check if this was a Reauth attempt (e.g. accessing Settings)
    const state = req.query.state ? JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii')) : {};

    if (state.purpose === 'reauth') {
        const reauthToken = jwt.sign(
            { id: user._id, purpose: 're-authentication' },
            process.env.JWT_REAUTH_SECRET,
            { expiresIn: '5m' }
        );
        return res.redirect(`${process.env.PRAXFORM_FRONTEND_HOST}/settings?tab=security&reauth_token=${reauthToken}`);
    }

    // Handle MFA on top of Google Auth (High Security)
    if (user.mfaEnabled) {
        const mfaToken = jwt.sign(
            { id: user._id, purpose: 'mfa-verification' },
            process.env.JWT_REAUTH_SECRET,
            { expiresIn: '5m' }
        );
        return res.redirect(`${process.env.PRAXFORM_FRONTEND_HOST}/verify-login?mfa_token=${mfaToken}&method=${user.mfaMethod}`);
    }

    // Standard Login
    const redirectPath = user.postAuthPath || null;
    await sendTokenResponse(user, 302, res, redirectPath);
});

const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        res.status(401); throw new Error('No refresh token provided.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            res.status(401); throw new Error('User not found.');
        }

        // Rotate Tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        const cookieDomain = process.env.PRAXFORM_ROOT_DOMAIN || undefined;
        
        // Match options from sendTokenResponse
        const commonOptions = {
            httpOnly: true,
            path: '/',
            domain: cookieDomain,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        };

        res.cookie('refreshToken', newRefreshToken, { ...commonOptions, expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        res.cookie('accessToken', accessToken, { ...commonOptions, expires: new Date(Date.now() + 15 * 60 * 1000) });

        res.json({ success: true, accessToken }); // Return AT for memory usage if needed
    } catch (err) {
        res.status(401); throw new Error('Invalid refresh token.');
    }
});

const logout = asyncHandler(async (req, res) => {
    const cookieDomain = process.env.PRAXFORM_ROOT_DOMAIN || undefined;
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(0), // Expire immediately
        path: '/',
        domain: cookieDomain,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    };

    res.cookie('refreshToken', '', cookieOptions);
    res.cookie('accessToken', '', cookieOptions);

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
            mfaMethod: user.mfaMethod,
            avatar: user.avatar
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

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


const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

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

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !(await user.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Incorrect old password.');
    }
    
    const passwordRulesRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRulesRegex.test(newPassword)) {
        res.status(400);
        throw new Error('New password must be at least 8 characters long, contain at least one number and one special character.');
    }

    user.passwordHash = newPassword;
    await user.save();

    const message = "Your account password was successfully changed.";
    await createNotification(user._id, user.currentOrganization, 'password_changed', message, '/settings/security');

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

const resetPassword = asyncHandler(async (req, res) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400); throw new Error('Invalid or expired token.');
    }

    user.passwordHash = req.body.password; // Assumes Pre-save hook hashes this
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await sendTokenResponse(user, 200, res);
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
    changePassword, 
};