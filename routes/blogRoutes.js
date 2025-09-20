const express = require('express');
const router = express.Router();
const {
    getPublishedPosts,
    getPostBySlug,
    createPost,
    getAllPostsAdmin,
    getPostByIdAdmin, // Import this
    updatePost,
    deletePost,
} = require('../controllers/blogController');

const { protect } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');

// --- Public Routes (Simplified) ---
router.route('/').get(getPublishedPosts);
router.route('/:slug').get(getPostBySlug);

// --- Admin Routes ---
router.route('/admin/all').get(protect, authorize('admin', 'owner'), getAllPostsAdmin);

// This route is for the Post Editor to fetch a post's data for editing
router.route('/admin/:id').get(protect, authorize('admin', 'owner'), getPostByIdAdmin);

router.route('/admin')
    .post(protect, authorize('admin', 'owner'), createPost);

router.route('/admin/:id')
    .put(protect, authorize('admin', 'owner'), updatePost)
    .delete(protect, authorize('admin', 'owner'), deletePost);

module.exports = router;