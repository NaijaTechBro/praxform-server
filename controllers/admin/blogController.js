const asyncHandler = require('express-async-handler');
const BlogPost = require('../../models/BlogPost');

// --- PUBLIC CONTROLLERS ---

/**
 * @desc      Get all published blog posts
 * @route     GET /api/v1/blog/posts
 * @access    Public
 */
const getPublishedPosts = asyncHandler(async (req, res) => {
    const posts = await BlogPost.find({ status: 'published' })
        .sort({ createdAt: -1 })
        .populate('author', 'firstName lastName avatar');
    res.status(200).json({ success: true, data: posts });
});

// Add this with your other controller functions

/**
 * @desc      Get the latest published blog post
 * @route     GET /api/v1/blog/posts/latest
 * @access    Public
 */
const getLatestPublishedPost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ status: 'published' })
    .sort({ createdAt: -1 })
    .populate('author', 'firstName lastName');

  if (!post) {
    // It's not an error if no post is found, just return empty
    return res.status(200).json({ success: true, data: null });
  }

  res.status(200).json({ success: true, data: post });
});

/**
 * @desc      Get a single published blog post by its slug
 * @route     GET /api/v1/blog/posts/:slug
 * @access    Public
 */
const getPostBySlug = asyncHandler(async (req, res) => {
    const post = await BlogPost.findOneAndUpdate(
        { slug: req.params.slug, status: 'published' },
        { $inc: { views: 1 } },
        { new: true }
    ).populate('author', 'firstName lastName avatar');

    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }
    res.status(200).json({ success: true, data: post });
});


// --- ADMIN CONTROLLERS ---

/**
 * @desc      Create a new blog post
 * @route     POST /api/v1/blog/posts/admin
 * @access    Private (Admin/Owner)
 */
const createPost = asyncHandler(async (req, res) => {
    req.body.author = req.user._id;
    try {
        const post = await BlogPost.create(req.body);
        res.status(201).json({ success: true, data: post });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400);
            throw new Error('A blog post with this title already exists.');
        }
        throw err;
    }
});

/**
 * @desc      Get all posts (drafts and published) for the admin dashboard
 * @route     GET /api/v1/blog/posts/admin/all
 * @access    Private (Admin/Owner)
 */
const getAllPostsAdmin = asyncHandler(async (req, res) => {
    const posts = await BlogPost.find({}).sort({ createdAt: -1 }).populate('author', 'firstName lastName');
    res.status(200).json({ success: true, count: posts.length, data: posts });
});

/**
 * @desc      Get a single post by ID for editing
 * @route     GET /api/v1/blog/posts/admin/:id
 * @access    Private (Admin/Owner)
 */
const getPostByIdAdmin = asyncHandler(async (req, res) => {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }
    res.status(200).json({ success: true, data: post });
});

/**
 * @desc      Update a blog post
 * @route     PUT /api/v1/blog/posts/admin/:id
 * @access    Private (Admin/Owner)
 */
const updatePost = asyncHandler(async (req, res) => {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }
    res.status(200).json({ success: true, data: post });
});

/**
 * @desc      Delete a blog post
 * @route     DELETE /api/v1/blog/posts/admin/:id
 * @access    Private (Admin/Owner)
 */
const deletePost = asyncHandler(async (req, res) => {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }
    await post.deleteOne();
    res.status(200).json({ success: true, data: {} });
});

module.exports = {
    getPublishedPosts,
    getPostBySlug,
    createPost,
    getAllPostsAdmin,
    getPostByIdAdmin,
    updatePost,
    deletePost,
    getLatestPublishedPost,
};