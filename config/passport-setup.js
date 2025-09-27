const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy({
        // Options for the Google strategy
        clientID: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
        clientSecret: process.env.PRAXFORM_GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
        // This function is called after the user authenticates with Google
        try {
            const email = profile.emails[0].value;

            // 1. Find user by their unique Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                // User already exists, log them in
                return done(null, user);
            }

            // 2. If no user with Google ID, check if email is already in use
            user = await User.findOne({ email });

            if (user) {
                // User exists but signed up with email/password. Link the account.
                // You could throw an error here if you don't want to auto-link
                user.googleId = profile.id;
                user.authMethod = 'google';
                user.isEmailVerified = true; // Google provides a verified email
                await user.save();
                return done(null, user);
            }

            // 3. If user does not exist at all, create a new user account
            // IMPORTANT: We do NOT create an organization here. We let the user do it on the frontend.
            const newUser = await User.create({
                googleId: profile.id,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName || ' ', // Handle cases with no last name
                email: email,
                authMethod: 'google',
                isEmailVerified: true,
            });

            return done(null, newUser);

        } catch (err) {
            return done(err, false, { message: 'Authentication failed.' });
        }
    })
);