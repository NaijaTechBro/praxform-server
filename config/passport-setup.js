const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy({
        clientID: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
        clientSecret: process.env.PRAXFORM_GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                return done(null, user); // User exists, proceed to log them in.
            }

            user = await User.findOne({ email });

            if (user) {
                // User exists via local auth, link their Google account.
                user.googleId = profile.id;
                user.authMethod = 'google';
                await user.save();
                return done(null, user);
            }

            // User is brand new, create a new user record.
            const newUser = await User.create({
                googleId: profile.id,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName || ' ',
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