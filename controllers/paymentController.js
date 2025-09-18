const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');
const User = require('../models/User');
const createNotification = require('../utils/createNotification');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- PLAN DEFINITIONS (WITH YOUR CORRECT PRICE IDs) ---
const PLANS = {
    starter: {
        name: 'Starter', priceId: 'price_1S8IcXFnPEdPZtOZOKjBDgTE', description: 'Full-featured form builder to create beautiful forms for all needs.', price: 0, frequency: '/year', priceDetails: 'pay once', isRecommended: false, originalPrice: null, monthlyOption: null,
        limits: { maxTeamMembers: 1, maxForms: 5, maxSubmissionsPerMonth: 50, maxTemplates: 3, },
        features: [ '1 team member', '50 submissions per month', '5 forms', '3 Custom templates creation', ],
    },
    pro: {
        name: 'Pro', priceId: 'price_1S8IbiFnPEdPZtOZSdfqfHri', description: 'All features to build advanced forms and elevate your business.', price: 49, frequency: '/year', priceDetails: 'pay once', isRecommended: false, originalPrice: null, monthlyOption: null,
        limits: { maxTeamMembers: 5, maxForms: 20, maxSubmissionsPerMonth: 1000, maxTemplates: 5, },
        features: [ '5 team members', '1,000 submissions per month', '20 forms', '5 custom templates', 'Create Forms Using AI', 'Webhooks & Zapier', 'Conditional Fields', 'Digital Signatures', ],
    },
    business: {
        name: 'Business', priceId: 'price_1S8Ie5FnPEdPZtOZbiju1yg2', description: 'For anyone who wants to transform their clients productivity and impress their clients.', price: 99, frequency: '/year', priceDetails: 'pay once', originalPrice: '$150', monthlyOption: 'or 11 x $13.6/mo **', isRecommended: true,
        limits: { maxTeamMembers: 20, maxForms: 100, maxSubmissionsPerMonth: -1, maxTemplates: 20, },
        features: [ '20 team members', 'Unlimited submissions', '100 forms', '20 custom templates', 'All Pro features', 'Stripe Integration', 'PDF Generator', 'User Registration Forms', 'Custom App (API Access)', ],
    },
};

const getPlans = asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: Object.values(PLANS) });
});

const createCheckoutSession = asyncHandler(async (req, res) => {
    const { priceId } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found.'); }
    const organizationId = req.user.currentOrganization;
    const organization = await Organization.findById(organizationId);
    if (!organization) { res.status(404); throw new Error('Organization not found.'); }
    let customerId = organization.customerId;
    if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, name: organization.name, metadata: { organizationId: organizationId.toString() } });
        customerId = customer.id;
        organization.customerId = customerId;
        await organization.save();
    }
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/settings/billing?canceled=true`,
        metadata: { organizationId: organizationId.toString(), userId: user._id.toString() }
    });
    res.status(200).json({ success: true, url: session.url });
});

const getCustomerPortal = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const organization = await Organization.findById(organizationId);
    if (!organization || !organization.customerId) { res.status(400); throw new Error('Customer ID not found for this organization.'); }
    const portalSession = await stripe.billingPortal.sessions.create({
        customer: organization.customerId,
        return_url: `${process.env.CLIENT_URL}/settings/billing`,
    });
    res.status(200).json({ success: true, url: portalSession.url });
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.sendStatus(400);
    }
    
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const { organizationId, userId } = session.metadata;
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const planId = subscription.items.data[0].price.id;
            const planKey = Object.keys(PLANS).find(key => PLANS[key].priceId === planId);
            
            if (planKey) {
                const planDetails = PLANS[planKey];
                // --- FIX: Safely create the date ---
                const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;

                await Organization.findByIdAndUpdate(organizationId, {
                    plan: planKey,
                    subscriptionId: subscription.id,
                    subscriptionStatus: subscription.status,
                    currentPeriodEnd: periodEnd, // Use the safe variable
                    planLimits: planDetails.limits,
                });
                await createNotification(userId, organizationId, 'plan_upgrade', `Your organization has been successfully upgraded to the ${planDetails.name} plan.`, '/settings/billing');
            }
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            if (invoice.billing_reason === 'subscription_cycle') {
                const organization = await Organization.findOne({ customerId: invoice.customer });
                if (organization) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    // --- FIX: Safely create the date ---
                    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
                    organization.subscriptionStatus = 'active';
                    organization.currentPeriodEnd = periodEnd; // Use the safe variable
                    await organization.save();
                }
            }
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            const organization = await Organization.findOne({ customerId: invoice.customer }).populate('members.userId');
            if (organization) {
                organization.subscriptionStatus = 'past_due';
                await organization.save();
                const ownerMember = organization.members.find(m => m.role === 'owner');
                if (ownerMember) {
                    const ownerId = ownerMember.userId._id;
                    await createNotification(ownerId, organization._id, 'payment_failed', 'Your subscription payment failed. Please update your billing information.', '/settings/billing');
                }
            }
            break;
        }
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const organization = await Organization.findOne({ subscriptionId: subscription.id });
            if (organization) {
                // --- FIX: Safely create the date ---
                const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
                organization.subscriptionStatus = subscription.status;
                organization.currentPeriodEnd = periodEnd; // Use the safe variable
                
                if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
                    const planId = subscription.items.data[0].price.id;
                    const planKey = Object.keys(PLANS).find(key => PLANS[key].priceId === planId);
                    if (planKey) {
                        organization.plan = planKey;
                        organization.planLimits = PLANS[planKey].limits;
                    }
                }
                await organization.save();
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const organization = await Organization.findOne({ subscriptionId: subscription.id });
            if (organization) {
                organization.plan = 'starter';
                organization.planLimits = PLANS.starter.limits;
                organization.subscriptionStatus = 'canceled';
                organization.subscriptionId = null;
                organization.currentPeriodEnd = null; // Also clear the end date
                await organization.save();
            }
            break;
        }
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    
    res.status(200).json({ received: true });
});

module.exports = {
    getPlans,
    createCheckoutSession,
    getCustomerPortal,
    handleStripeWebhook
};