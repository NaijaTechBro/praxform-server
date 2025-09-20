const asyncHandler = require('express-async-handler');
const BlogPost = require('../models/BlogPost');

// --- PUBLIC CONTROLLERS ---

// @desc      Get all published blog posts (paginated)
// @route     GET /api/v1/blog/posts
// @access    Public
const getPublishedPosts = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const posts = await BlogPost.find({ status: 'published' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'firstName lastName avatar');

    const totalPosts = await BlogPost.countDocuments({ status: 'published' });

    res.status(200).json({
        success: true,
        count: posts.length,
        pagination: {
            totalPages: Math.ceil(totalPosts / limit),
            currentPage: page,
        },
        data: posts,
    });
});

// @desc      Get a single published blog post by its slug
// @route     GET /api/v1/blog/posts/:slug
// @access    Public
const getPostBySlug = asyncHandler(async (req, res) => {
    // Find the post and atomically increment its view count
    const post = await BlogPost.findOneAndUpdate(
        { slug: req.params.slug, status: 'published' },
        { $inc: { views: 1 } },
        { new: true } // Return the updated document
    ).populate('author', 'firstName lastName avatar');

    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }

    res.status(200).json({ success: true, data: post });
});


// --- ADMIN CONTROLLERS ---

// @desc      Create a new blog post
// @route     POST /api/v1/blog/posts
// @access    Private/Admin
const createPost = asyncHandler(async (req, res) => {
    // The author is the logged-in user
    req.body.author = req.user._id;

    const post = await BlogPost.create(req.body);
    res.status(201).json({ success: true, data: post });
});

// @desc      Get all posts (drafts and published)
// @route     GET /api/v1/blog/posts/admin
// @access    Private/Admin
const getAllPostsAdmin = asyncHandler(async (req, res) => {
    const posts = await BlogPost.find({}).sort({ createdAt: -1 }).populate('author', 'firstName lastName');
    res.status(200).json({ success: true, count: posts.length, data: posts });
});

// @desc      Update a blog post
// @route     PUT /api/v1/blog/posts/:id
// @access    Private/Admin
const updatePost = asyncHandler(async (req, res) => {
    let post = await BlogPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }

    // Update fields
    post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({ success: true, data: post });
});

// @desc      Delete a blog post
// @route     DELETE /api/v1/blog/posts/:id
// @access    Private/Admin
const deletePost = asyncHandler(async (req, res) => {
    const post = await BlogPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Blog post not found');
    }

    await post.deleteOne(); // This triggers the pre('deleteOne') hook in the model

    res.status(200).json({ success: true, data: {} });
});


module.exports = {
    getPublishedPosts,
    getPostBySlug,
    createPost,
    getAllPostsAdmin,
    updatePost,
    deletePost,
};