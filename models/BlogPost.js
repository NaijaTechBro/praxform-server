const mongoose = require('mongoose');
const slugify = require('slugify');
const { deleteFromCloudinary } = require('../utils/cloudinary');

const BlogPostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a title'],
        unique: true,
        trim: true,
    },
    slug: {
        type: String,
        unique: true,
        index: true,
    },
    content: {
        type: String, // We'll store the content as Markdown
        required: [true, 'Please provide content'],
    },
    featuredImage: {
        public_id: { type: String },
        url: { type: String }
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft',
    },
    categories: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, 'Meta description cannot be more than 160 characters'],
    },
    readingTime: { // In minutes
        type: Number,
        default: 1,
    },
    views: {
        type: Number,
        default: 0,
    }
}, { timestamps: true });

// Middleware to automatically create a slug from the title before saving
BlogPostSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    // Calculate reading time (average 200 words per minute)
    if (this.isModified('content')) {
        const wordCount = this.content.split(/\s+/).length;
        this.readingTime = Math.ceil(wordCount / 200);
    }
    next();
});

// Middleware to delete the featured image from Cloudinary when a post is deleted
BlogPostSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    if (this.featuredImage && this.featuredImage.public_id) {
        await deleteFromCloudinary(this.featuredImage.public_id);
    }
    next();
});

const BlogPost = mongoose.model('BlogPost', BlogPostSchema);
module.exports = BlogPost;