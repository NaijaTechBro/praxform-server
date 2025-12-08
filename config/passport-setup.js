

// const cloudinary = require('../config/cloudinary');
// const validator = require('validator');

// /**
//  * Uploads an external image URL to Cloudinary, serving as a secure proxy.
//  * @param {string} externalUrl - The external URL (e.g., Google photo URL).
//  * @param {string} folder - The target folder in Cloudinary (e.g., 'avatars').
//  * @returns {Promise<string|null>} - The secure Cloudinary URL or null on failure.
//  */
// const uploadExternalImageToCloudinary = async (externalUrl, folder = 'avatars') => {
//     // SSRF Protection: Validate it is a real HTTP/HTTPS URL
//     if (!validator.isURL(externalUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
//         console.error('SSRF Defense: Invalid or non-public URL rejected.', externalUrl);
//         return null;
//     }
    
//     try {
//         const result = await cloudinary.uploader.upload(externalUrl, {
//             folder: folder, 
//             resource_type: 'image', 
//         });

//         return result.secure_url; 
//     } catch (error) {
//         console.error('Cloudinary upload failed for external URL:', error.message);
//         return null; 
//     }
// };

// /**
//  * Deletes a file from Cloudinary.
//  * @param {string} publicId - The public_id of the file to delete.
//  * @returns {Promise<object>} - The result from the Cloudinary API.
//  */
// const deleteFromCloudinary = async (publicId) => {
//   try {
//     const result = await cloudinary.uploader.destroy(publicId);
//     console.log(`Successfully deleted ${publicId} from Cloudinary.`, result);
//     return result;
//   } catch (error) {
//     console.error(`Failed to delete ${publicId} from Cloudinary.`, error);
//   }
// };

// module.exports = { 
//     deleteFromCloudinary,
//     uploadExternalImageToCloudinary
// };


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
            const originalAvatarUrl = photos ? photos[0].value : null;
            let avatarUrl = null;
            
            // Only upload if we have a URL
            if (originalAvatarUrl) {
                try {
                    avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl, 'praxform_avatars');
                } catch (e) {
                    avatarUrl = null;
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
                    // Capture other state params if needed (e.g., invite tokens)
                } catch (e) {
                    console.error("Failed to parse Google state:", e.message);
                }
            }

            try {
                // --- 3. Check if Google ID exists (Login) ---
                let user = await User.findOne({ googleId: id });

                if (user) {
                    user.lastLogin = new Date();
                    // If user has a new avatar and didn't have one before, update it (optional)
                    if (!user.avatar && avatarUrl) user.avatar = avatarUrl;
                    
                    await user.save();
                    user.postAuthPath = postAuthPath; // Attach for controller
                    return done(null, user);
                }

                // --- 4. Hybrid Auth: Check if email exists (Linking) ---
                const existingEmailUser = await User.findOne({ email });

                if (existingEmailUser) {
                    if (existingEmailUser.authMethod === 'local') {
                        // MERGE ACCOUNT
                        existingEmailUser.googleId = id;
                        existingEmailUser.authMethod = 'google'; // Upgrade security
                        existingEmailUser.isEmailVerified = true; 
                        existingEmailUser.lastLogin = new Date();
                        if (!existingEmailUser.avatar && avatarUrl) existingEmailUser.avatar = avatarUrl;

                        await existingEmailUser.save();
                        existingEmailUser.postAuthPath = postAuthPath;
                        return done(null, existingEmailUser);
                    } else {
                         // Email exists but maybe linked to another provider (if you add GitHub/etc later)
                        return done(new Error(`This email is already linked to another account type.`), null);
                    }
                }

                // --- 5. Create New User (Registration) ---
                // Note: In Praxform, new users usually need an Organization. 
                // We create the user here, but the Controller will force them to "Setup" if no Org exists.
                
                const firstName = name.givenName || 'User';
                const lastName = name.familyName || '';
                
                const newUser = await User.create({
                    googleId: id,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    avatar: avatarUrl,
                    authMethod: 'google',
                    isEmailVerified: true,
                    lastLogin: new Date(),
                    // User starts without an organization
                    organizations: [],
                    currentOrganization: null
                });

                newUser.postAuthPath = postAuthPath;
                return done(null, newUser);

            } catch (err) {
                return done(err, false, { message: 'Authentication failed.' });
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});