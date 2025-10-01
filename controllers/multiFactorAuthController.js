const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// @desc    Re-authenticate user with password before a sensitive action
// @route   POST /api/v1/mfa/reauthenticate
// @access  Private
const reauthenticate = asyncHandler(async (req, res) => {
    const { password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !(await user.matchPassword(password))) {
        res.status(401);
        throw new Error('Incorrect password.');
    }

    // If password is correct, issue a short-lived re-authentication token
    const reauthToken = jwt.sign(
        { id: user._id, purpose: 're-authentication' },
        process.env.JWT_REAUTH_SECRET,
        { expiresIn: '5m' }
    );

    res.status(200).json({ success: true, reauthToken });
});

// @desc    Setup Google Authenticator (generates temp secret and QR)
// @route   POST /api/v1/mfa/setup-google
// @access  Private (Re-Auth Protected)
const setupGoogleAuthenticator = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    const secret = speakeasy.generateSecret({ name: `PraxForm (${user.email})` });

    // Store the secret temporarily until it's verified
    user.tempGoogleAuthenticatorSecret = secret.base32;
    user.tempSecretExpires = Date.now() + 600000; // Expires in 10 minutes
    await user.save({ validateBeforeSave: false });

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) {
            console.error('QR Code Error:', err);
            res.status(500);
            throw new Error('Could not generate QR code.');
        }
        res.json({
            success: true,
            secret: secret.base32,
            qrCodeUrl: data_url,
        });
    });
});

// @desc    Verify Google Authenticator token and finalize setup
// @route   POST /api/v1/mfa/verify-google
// @access  Private (Re-Auth Protected)
const verifyGoogleAuthenticator = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const user = await User.findById(req.user._id).select('+tempGoogleAuthenticatorSecret');

    if (!user.tempGoogleAuthenticatorSecret) {
        res.status(400);
        throw new Error('MFA setup has not been initiated or has expired.');
    }

    const isVerified = speakeasy.totp.verify({
        secret: user.tempGoogleAuthenticatorSecret,
        encoding: 'base32',
        token: token,
        window: 1,
    });

    if (isVerified) {
        // Verification successful, promote the temp secret to a permanent one
        user.googleAuthenticatorSecret = user.tempGoogleAuthenticatorSecret;
        user.tempGoogleAuthenticatorSecret = undefined;
        user.tempSecretExpires = undefined;
        user.mfaEnabled = true;
        user.mfaMethod = 'app';
        await user.save();

        // Send back the flag to trigger the "Render flow" logout
        res.json({
            success: true,
            message: 'Google Authenticator enabled successfully!',
            validationRequired: true
        });
    } else {
        res.status(400);
        throw new Error('Invalid authenticator token. Please try again.');
    }
});

// @desc    Disable any MFA method for the user
// @route   PUT /api/v1/mfa/disable
// @access  Private (Re-Auth Protected)
const disableMfa = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    user.mfaEnabled = false;
    user.mfaMethod = undefined;
    user.googleAuthenticatorSecret = undefined;
    // Clear any leftover temp secrets as well
    user.tempGoogleAuthenticatorSecret = undefined;
    user.tempSecretExpires = undefined;

    await user.save();

    res.json({ success: true, message: 'Two-Factor Authentication has been disabled.' });
});


module.exports = {
    reauthenticate,
    setupGoogleAuthenticator,
    verifyGoogleAuthenticator,
    disableMfa,
};