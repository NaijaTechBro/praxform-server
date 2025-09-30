const mongoose = require('mongoose');

const DemoRequestSchema = new mongoose.Schema({
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
        required: [true, 'Phone number is required.'],
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'scheduled', 'completed', 'cancelled'],
        default: 'pending'
    },
    scheduledTime: {
        type: Date
    },
    notes: { 
        type: String
    }
}, { timestamps: true });

const DemoRequest = mongoose.model('DemoRequest', DemoRequestSchema);

module.exports = DemoRequest;