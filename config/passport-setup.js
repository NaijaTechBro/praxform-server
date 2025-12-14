
// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/User');
// const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');
// const crypto = require('crypto');

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
//             clientSecret: process.env.PRAXFORM_GOOGLE_CLIENT_SECRET,
//             callbackURL: '/api/v1/auth/google/callback',
//             passReqToCallback: true, // Vital for accessing req.query.state
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             const { id, name, emails, photos } = profile;
//             const email = emails[0].value;

//             // --- 1. Avatar Handling ---
//             const originalAvatarUrl = photos ? photos[0].value : null;
//             let avatarUrl = null;
            
//             // Only upload if we have a URL
//             if (originalAvatarUrl) {
//                 try {
//                     avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl, 'praxform_avatars');
//                 } catch (e) {
//                     avatarUrl = null;
//                 }
//             }

//             // --- 2. Context/State Extraction ---
//             let postAuthPath = null;
            
//             if (req.query.state) {
//                 try {
//                     const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
//                     if (state.path) {
//                         postAuthPath = state.path; // Capture where the user wanted to go
//                     }
//                     // Capture other state params if needed (e.g., invite tokens)
//                 } catch (e) {
//                     console.error("Failed to parse Google state:", e.message);
//                 }
//             }

//             try {
//                 // --- 3. Check if Google ID exists (Login) ---
//                 let user = await User.findOne({ googleId: id });

//                 if (user) {
//                     user.lastLogin = new Date();
//                     // If user has a new avatar and didn't have one before, update it (optional)
//                     if (!user.avatar && avatarUrl) user.avatar = avatarUrl;
                    
//                     await user.save();
//                     user.postAuthPath = postAuthPath; // Attach for controller
//                     return done(null, user);
//                 }

//                 // --- 4. Hybrid Auth: Check if email exists (Linking) ---
//                 const existingEmailUser = await User.findOne({ email });

//                 if (existingEmailUser) {
//                     if (existingEmailUser.authMethod === 'local') {
//                         // MERGE ACCOUNT
//                         existingEmailUser.googleId = id;
//                         existingEmailUser.authMethod = 'google'; // Upgrade security
//                         existingEmailUser.isEmailVerified = true; 
//                         existingEmailUser.lastLogin = new Date();
//                         if (!existingEmailUser.avatar && avatarUrl) existingEmailUser.avatar = avatarUrl;

//                         await existingEmailUser.save();
//                         existingEmailUser.postAuthPath = postAuthPath;
//                         return done(null, existingEmailUser);
//                     } else {
//                          // Email exists but maybe linked to another provider (if you add GitHub/etc later)
//                         return done(new Error(`This email is already linked to another account type.`), null);
//                     }
//                 }

//                 // --- 5. Create New User (Registration) ---
//                 // Note: In Praxform, new users usually need an Organization. 
//                 // We create the user here, but the Controller will force them to "Setup" if no Org exists.
                
//                 const firstName = name.givenName || 'User';
//                 const lastName = name.familyName || '';
                
//                 const newUser = await User.create({
//                     googleId: id,
//                     firstName: firstName,
//                     lastName: lastName,
//                     email: email,
//                     avatar: avatarUrl,
//                     authMethod: 'google',
//                     isEmailVerified: true,
//                     lastLogin: new Date(),
//                     // User starts without an organization
//                     organizations: [],
//                     currentOrganization: null
//                 });

//                 newUser.postAuthPath = postAuthPath;
//                 return done(null, newUser);

//             } catch (err) {
//                 return done(err, false, { message: 'Authentication failed.' });
//             }
//         }
//     )
// );

// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (err) {
//         done(err, null);
//     }
// });



const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');
const crypto = require('crypto');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.PRAXFORM_GOOGLE_CLIENT_ID,
            clientSecret: process.env.PRAXFORM_GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/google/callback',
            passReqToCallback: true, // Vital for accessing req.query.state
        },
        async (req, accessToken, refreshToken, profile, done) => {
            const { id, name, emails, photos } = profile;
            const email = emails[0].value;

            // --- 1. Avatar Handling ---
            // Existing logic is correct: upload and get Cloudinary URL
            const originalAvatarUrl = photos ? photos[0].value : null;
            let avatarData = null; 
            
            if (originalAvatarUrl) {
                try {
                    const uploadResult = await uploadExternalImageToCloudinary(originalAvatarUrl, 'praxform_avatars');
                    // Ensure the structure matches your User model's avatar field
                    avatarData = {
                        public_id: uploadResult.public_id,
                        url: uploadResult.url
                    };
                } catch (e) {
                    console.error("Error uploading Google avatar:", e.message);
                }
            }

            // --- 2. Context/State Extraction ---
            let postAuthPath = null;
            if (req.query.state) {
                try {
                    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
                    if (state.path) {
                        postAuthPath = state.path; // Capture where the user wanted to go
                    }
                    // The main auth controller (googleAuthCallback) handles other state purposes (reauth, setup)
                } catch (e) {
                    // console.error("Failed to parse Google state:", e.message); // Keep silent for clean logs
                }
            }

            try {
                // --- A. GOOGLE LOGIN (User already linked) ---
                let user = await User.findOne({ googleId: id });

                if (user) {
                    // Update user fields
                    user.lastLogin = new Date();
                    // Update avatar only if the user doesn't have one set (to preserve custom avatars)
                    if (!user.avatar || !user.avatar.url) user.avatar = avatarData;
                    
                    await user.save();
                    user.postAuthPath = postAuthPath; 
                    return done(null, user);
                }

                // --- B. HYBRID LINKING / EMAIL MERGE (Email exists, link the accounts) ---
                const existingEmailUser = await User.findOne({ email });

                if (existingEmailUser) {
                    // LOGIC ERROR FIX: The 'else' block below was checking authMethod and throwing an error,
                    // which prevents linking. Since the email is unique, we must link it here.
                    
                    // Merge/Link Account: Add Google ID to the existing user.
                    existingEmailUser.googleId = id;
                    // Note: We don't change authMethod from 'local' to 'google', 
                    // this allows them to continue using BOTH methods.
                    
                    existingEmailUser.isEmailVerified = true; // Trust Google verification
                    existingEmailUser.lastLogin = new Date();
                    if (!existingEmailUser.avatar || !existingEmailUser.avatar.url) existingEmailUser.avatar = avatarData;

                    await existingEmailUser.save();
                    existingEmailUser.postAuthPath = postAuthPath;
                    return done(null, existingEmailUser);
                }


                // --- C. NEW GOOGLE REGISTRATION (Create brand new user) ---
                
                const firstName = name.givenName || 'User';
                const lastName = name.familyName || '';
                
                const newUser = await User.create({
                    googleId: id,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    avatar: avatarData,
                    authMethod: 'google', // Explicitly set as Google registration
                    isEmailVerified: true, // Trusted by Google
                    lastLogin: new Date(),
                    // User starts without an organization (The controller handles the setup redirect)
                    organizations: [],
                    currentOrganization: null
                });

                newUser.postAuthPath = postAuthPath;
                return done(null, newUser);

            } catch (err) {
                console.error("Google Auth Strategy Error:", err);
                // Return generic message for security
                return done(new Error('Authentication failed.'), false);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    // We only serialize the Mongoose ID (or whatever is unique)
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        // Deserialize finds the user by ID for subsequent requests
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});