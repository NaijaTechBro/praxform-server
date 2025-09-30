const mongoose = require('mongoose');

const ContactInquirySchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required.'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required.'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'is invalid']
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    message: {
        type: String,
        required: [true, 'A message is required.']
    },
    status: {
        type: String,
        enum: ['new', 'read', 'responded'],
        default: 'new'
    }
}, { timestamps: true });

const ContactInquiry = mongoose.model('ContactInquiry', ContactInquirySchema);

module.exports = ContactInquiry;