const express = require('express');
const router = express.Router();
const {
    getPublishedPosts,
    getPostBySlug,
    createPost,
    getAllPostsAdmin,
    updatePost,
    deletePost,
} = require('../controllers/blogController');

const { protect } = require('../middleware/authMiddleware');
const authorizeMiddleware = require('../middleware/authorizeMiddleware');

// --- Public Routes ---
router.route('/').get(getPublishedPosts);
router.route('/:slug').get(getPostBySlug);

// --- Admin Routes ---
// These routes require the user to be logged in AND have an 'admin' or 'owner' role.
router.route('/admin/all').get(protect, authorize('admin', 'owner'), getAllPostsAdmin);

router.route('/admin')
    .post(protect, authorize('admin', 'owner'), createPost);

router.route('/admin/:id')
    .put(protect, authorize('admin', 'owner'), updatePost)
    .delete(protect, authorize('admin', 'owner'), deletePost);

module.exports = router;