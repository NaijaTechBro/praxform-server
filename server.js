const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const passport = require('passport');
const session = require('express-session'); 
const MongoStore = require('connect-mongo'); 

// Route Files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const formRoutes = require('./routes/formRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const auditRoutes = require('./routes/auditRoutes');
const formtemplateRoutes = require('./routes/formtemplateRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const blogRoutes = require('./routes/blogRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes')

const { handleStripeWebhook } = require('./controllers/paymentController');
require('./config/passport-setup');

connectDB();

const app = express();
app.set('trust proxy', 1);

app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }), // Use Mongo for session storage
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // Optional: set cookie expiry to 7 days
    }
}));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Mount Routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/submissions', submissionRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/form-templates', formtemplateRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/blog/posts', blogRoutes);
app.use('/api/v1/superadmin', superAdminRoutes);

// Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});