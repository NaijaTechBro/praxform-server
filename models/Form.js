// const mongoose = require('mongoose');

// const FormSchema = new mongoose.Schema({
//     name: { type: String, required: true, trim: true },
//     description: { type: String, trim: true },
//     organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
//     images: [{
//         public_id: { type: String, required: true },
//         url: { type: String, required: true },
//         original_filename: { type: String }
//     }],
//     template: { type: mongoose.Schema.Types.ObjectId, ref: 'FormTemplate' },
//     fields: { type: Array, default: [] },
//     status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'draft' },
//     recipients: [{
//         email: String,
//         name: String,
//         phone: String,
//         uniqueAccessCode: String,
//         status: { type: String, enum: ['pending', 'viewed', 'completed'], default: 'pending' },
//         verificationCode: { type: String },
//         verificationCodeExpires: { type: Date }
//     }],
//     submissionCount: { type: Number, default: 0 },
//     createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     encryptionKey: { type: String, required: false },
//     settings: {
//         oneTimeUse: { type: Boolean, default: false },
//         requireSmsAuth: { type: Boolean, default: false },
//         requireEmailAuth: { type: Boolean, default: false },
//         dueDate: { type: Date, default: null }
//     },
//     publicLink: {
//         enabled: { type: Boolean, default: false },
//         uniqueAccessCode: { type: String, unique: true, sparse: true }
//     }
// }, { timestamps: true });

// FormSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
//     console.log(`Deleting submissions for form: ${this._id}`);
//     await this.model('Submission').deleteMany({ form: this._id });
//     next();
// });

// //Expanded the existing hook to also delete form images from Cloudinary
// FormSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
//     console.log(`Deleting submissions for form: ${this._id}`);
//     await this.model('Submission').deleteMany({ form: this._id });
    
//     if (this.images && this.images.length > 0) {
//         console.log(`Deleting ${this.images.length} images for form: ${this._id}`);
//         const deletions = this.images.map(img => deleteFromCloudinary(img.public_id));
//         await Promise.all(deletions);
//     }
    
//     next();
// });



// const Form = mongoose.model('Form', FormSchema);
// module.exports = Form;



const mongoose = require('mongoose');
const { deleteFromCloudinary } = require('../utils/cloudinary');

const FormSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'FormTemplate' },
    fields: { type: Array, default: [] },
    status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'draft' },
    headerImage: {
        public_id: { type: String },
        url: { type: String }
    },
    recipients: [{
        email: String,
        name: String,
        phone: String,
        uniqueAccessCode: String,
        status: { type: String, enum: ['pending', 'viewed', 'completed'], default: 'pending' },
        verificationCode: { type: String },
        verificationCodeExpires: { type: Date }
    }],
    submissionCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    encryptionKey: { type: String, required: false },
    settings: {
        oneTimeUse: { type: Boolean, default: false },
        requireSmsAuth: { type: Boolean, default: false },
        requireEmailAuth: { type: Boolean, default: false },
        dueDate: { type: Date, default: null },
        watermarkImage: {
            public_id: { type: String },
            url: { type: String }
        }
    },
    publicLink: {
        enabled: { type: Boolean, default: false },
        uniqueAccessCode: { type: String, unique: true, sparse: true }
    }
}, { timestamps: true });

FormSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    // Delete associated submissions
    await this.model('Submission').deleteMany({ form: this._id });
    
    // Delete the form's header image from Cloudinary
    if (this.headerImage && this.headerImage.public_id) {
        await deleteFromCloudinary(this.headerImage.public_id);
    }

    // Delete the form's watermark image from Cloudinary
    if (this.settings.watermarkImage && this.settings.watermarkImage.public_id) {
        await deleteFromCloudinary(this.settings.watermarkImage.public_id);
    }
    next();
});

const Form = mongoose.model('Form', FormSchema);
module.exports = Form;