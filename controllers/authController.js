const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const sendEmail = require('../utils/email/sendEmail');

// Helper function to generate a 6-digit numeric code
const generateSixDigitCode = () => {
    // Generate a random number between 100000 (inclusive) and 999999 (inclusive)
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    try {
        const { firstName, lastName, email, password, organization, role } = req.body;

        // --- Input Validation ---
        if (!email || !password || !firstName || !lastName || !organization || !organization.name || !organization.industry) {
            res.status(400);
            throw new Error('Please provide all required user (firstName, lastName, email, password) and organization (name, industry) fields.');
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            res.status(400);
            throw new Error('User with this email already exists.');
        }

        // --- Role Validation ---
        const userRole = role || 'user'; // Default role to 'user' if not provided
        if (userRole !== 'user' && userRole !== 'admin') {
            res.status(400);
            throw new Error('Invalid role specified. Role must be "user" or "admin".');
        }

        // --- Create New Organization ---
        const newOrganization = await Organization.create({
            name: organization.name,
            slug: organization.name.toLowerCase().replace(/\s+/g, '-'),
            industry: organization.industry
        });

        // --- Generate Email Verification Code ---
        const verificationCode = generateSixDigitCode();
        // Hash the code before saving to the database for security
        const emailVerificationCodeHashed = crypto.createHash('sha256').update(verificationCode).digest('hex');
        const emailVerificationCodeExpires = Date.now() + 3600000; // Code valid for 1 hour

        // --- Create User in Database ---
        const user = await User.create({
            firstName,
            lastName,
            email,
            passwordHash: password, // Password will be hashed by Mongoose pre-save hook
            organizations: [newOrganization._id], // Associate user with the new organization
            currentOrganization: newOrganization._id, // Set as current organization
            role: userRole,
            authMethod: 'local',
            isEmailVerified: false, // User is not verified until they enter the code
            emailVerificationToken: emailVerificationCodeHashed, // Storing hashed code here
            emailVerificationTokenExpires: emailVerificationCodeExpires
        });

        // Add the created user as an 'owner' of the new organization
        newOrganization.members.push({ userId: user._id, role: 'owner' });
        await newOrganization.save();

        // --- Send Verification Email with Code ---
        const subject = "Verify Your Email for PraxForm"; // Custom subject
        const send_to = user.email;
        const sent_from = `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`;
        const reply_to = process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com';
        const template = "verification"; 
        const name = user.firstName;
        const code = verificationCode; 

        try {
            await sendEmail({
                subject,
                send_to,
                sent_from,
                reply_to,
                template,
                name,
                code 
            });

            // If everything is successful, send a success response
            return res.status(201).json({
                success: true,
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                message: 'User registered successfully. Please check your email for the verification code.'
            });

        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
            // If email sending fails, revert the token to prevent invalid attempts and log the error
            user.emailVerificationToken = undefined;
            user.emailVerificationTokenExpires = undefined;
            await user.save();

            // Respond with an error indicating email sending failed but user was registered
            return res.status(500).json({
                success: false,
                message: 'User registered but failed to send verification email. Please try resending verification later.'
            });
        }

    } catch (err) {
        // Catch any errors from initial validation, database operations, etc.
        console.error('Error during user registration:', err);
        // Set appropriate status code based on the error type, default to 500
        const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        res.status(statusCode);
        throw new Error(err.message || 'Server error while registering user.');
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

// @desc    Resend email verification
// @route   POST /api/v1/auth/resendverification
// @access  Public
const resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.isEmailVerified) {
        res.status(400).json({ message: 'Email already verified' });
        return;
    }

    // Generate new 6-digit email verification code
    const verificationCode = generateSixDigitCode();
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
    user.emailVerificationTokenExpires = Date.now() + 3600000; // 1 hour expiry

    await user.save();

    // Send verification email with code
    const emailSubject = "Verify Your Email for PraxForm";
    const sendToEmail = user.email;
    const sentFromEmail = `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`;
    const replyToEmail = process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com';
    const emailTemplateName = "verification";
    const recipientName = user.firstName;
    const code = verificationCode; // Pass the 6-digit code

    try {
        await sendEmail({
            subject: emailSubject,
            send_to: sendToEmail,
            sent_from: sentFromEmail,
            reply_to: replyToEmail,
            template: emailTemplateName,
            name: recipientName,
            code: code // Pass the 6-digit code
        });

        res.json({ success: true, message: 'Verification email with new code sent' });
    } catch (err) {
        console.error(err);
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        await user.save(); // Revert token on error
        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Verify user email
// @route   GET /api/v1/auth/verifyemail/:code
// @access  Public
const verifyEmail = asyncHandler(async (req, res) => {
    const rawCode = req.params.token; 

    // Hash the received code to compare with the stored hashed code
    const verificationCodeHashed = crypto.createHash('sha256').update(rawCode).digest('hex');

    const user = await User.findOne({
        emailVerificationToken: verificationCodeHashed,
        emailVerificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification code');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully' });
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User with that email not found');
    }

    // Generate 6-digit reset code
    const resetCode = generateSixDigitCode();
    user.resetPasswordToken = crypto.createHash('sha256').update(resetCode).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry

    await user.save();

    // Send reset email with code
    const emailSubject = "Password Reset Request for PraxForm";
    const sendToEmail = user.email;
    const sentFromEmail = `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`;
    const replyToEmail = process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com';
    const emailTemplateName = "passwordReset";
    const recipientName = user.firstName;
    const code = resetCode; // Pass the 6-digit code

    try {
        await sendEmail({
            subject: emailSubject,
            send_to: sendToEmail,
            sent_from: sentFromEmail,
            reply_to: replyToEmail,
            template: emailTemplateName,
            name: recipientName,
            code: code // Pass the 6-digit code
        });

        res.json({ success: true, message: 'Password reset code sent to your email. Please check your inbox.' });
    } catch (err) {
        console.error(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save(); // Revert token on error
        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:code (Frontend expects this format)
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    // Frontend is sending the 6-digit code as a URL parameter (req.params.token)
    const rawCode = req.params.token;
    const { password } = req.body; // New password from the request body

    // Hash the received code to compare with the stored hashed code
    const resetPasswordCodeHashed = crypto.createHash('sha256').update(rawCode).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: resetPasswordCodeHashed,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset code');
    }

    // Ensure a new password is provided in the request body
    if (!password) {
        res.status(400);
        throw new Error('Please provide a new password.');
    }

    user.passwordHash = password; // password will be hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
});


module.exports = {
    registerUser,
    loginUser,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
};
