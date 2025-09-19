const mongoose = require('mongoose');

const FormTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    images: [{
        public_id: { type: String, required: true },
        url: { type: String, required: true },
        original_filename: { type: String }
    }],
    isPublic: { type: Boolean, default: false },
    category: { type: String, enum: ['payment', 'tax', 'onboarding', 'consent', 'survey', 'other'], default: 'other' },
    fields: { type: Array, default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

//Expanded the existing hook to also delete form images from Cloudinary
FormTemplateSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Deleting submissions for form: ${this._id}`);
    await this.model('FormTemplate').deleteMany({ form: this._id });
    
    if (this.images && this.images.length > 0) {
        console.log(`Deleting ${this.images.length} images for form: ${this._id}`);
        const deletions = this.images.map(img => deleteFromCloudinary(img.public_id));
        await Promise.all(deletions);
    }
    
    next();
});

const FormTemplate = mongoose.model('FormTemplate', FormTemplateSchema);
module.exports = FormTemplate;