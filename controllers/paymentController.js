const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');
const createNotification = require('../utils/createNotification');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- PLAN DEFINITIONS ---
// Price IDs from your Stripe dashboard
const PLANS = {
    starter: {
        name: 'Starter',
        priceId: 'price_1S8IcXFnPEdPZtOZOKjBDgTE',
        price: 0,
        frequency: '/year',
        limits: {
            maxTeamMembers: 1,
            maxForms: 5,
            maxSubmissionsPerMonth: 50,
            maxTemplates: 3,
        },
        features: [
            '1 team member',
            '50 submissions per month',
            '5 forms',
            '3 Custom templates creation',
        ],
    },
    pro: {
        name: 'Pro',
        priceId: 'price_1S8IbiFnPEdPZtOZSdfqfHri',
        price: 49,
        frequency: '/year',
        limits: {
            maxTeamMembers: 5,
            maxForms: 20,
            maxSubmissionsPerMonth: 1000,
            maxTemplates: 5,
        },
        features: [
            '5 team members',
            '1,000 submissions per month',
            '20 forms',
            '5 custom templates',
            'Create Forms Using AI',
            'Webhooks & Zapier',
            'Conditional Fields',
            'Digital Signatures',
        ],
    },
    business: {
        name: 'Business',
        priceId: 'price_1S8Ie5FnPEdPZtOZbiju1yg2',
        price: 99,
        frequency: '/year',
        limits: {
            maxTeamMembers: 20,
            maxForms: 100,
            maxSubmissionsPerMonth: -1, // -1 for unlimited
            maxTemplates: 20,
        },
        features: [
            '20 team members',
            'Unlimited submissions',
            '100 forms',
            '20 custom templates',
            'All Pro features',
            'Stripe Integration',
            'PDF Generator',
            'User Registration Forms',
            'Custom App (API Access)',
        ],
    },
};

// @desc    Get all available subscription plans
// @route   GET /api/v1/payments/plans
// @access  Private
const getPlans = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: Object.values(PLANS) // Return plans as an array
    });
});

// @desc    Create a Stripe checkout session for a plan
// @route   POST /api/v1/payments/create-checkout-session
// @access  Private
const createCheckoutSession = asyncHandler(async (req, res) => {
    const { priceId } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.currentOrganization;

    const plan = Object.values(PLANS).find(p => p.priceId === priceId);
    if (!plan) {
        res.status(400);
        throw new Error('Invalid plan selected.');
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found.');
    }

    // Create a new Stripe customer if one doesn't exist
    let customerId = organization.customerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: req.user.email,
            name: organization.name,
            metadata: {
                organizationId: organizationId.toString(),
            },
        });
        customerId = customer.id;
        organization.customerId = customerId;
        await organization.save();
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: customerId,
        line_items: [{
            price: priceId,
            quantity: 1
        }],
        success_url: `${process.env.CLIENT_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.CLIENT_URL}/settings/billing?canceled=true`,
        // Pass metadata to identify the org in the webhook
        metadata: {
            organizationId: organizationId.toString(),
            userId: userId.toString()
        }
    });

    res.status(200).json({ success: true, url: session.url });
});

// @desc    Create a Stripe portal session to manage subscription
// @route   GET /api/v1/payments/customer-portal
// @access  Private
const getCustomerPortal = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const organization = await Organization.findById(organizationId);

    if (!organization || !organization.customerId) {
        res.status(400);
        throw new Error('No subscription found for this organization.');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: organization.customerId,
        return_url: `${process.env.CLIENT_URL}/settings/billing`,
    });

    res.status(200).json({ success: true, url: portalSession.url });
});


// @desc    Handle webhooks from Stripe
// @route   POST /api/v1/payments/webhook
// @access  Public (Stripe needs to access this)
const handleStripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, // Use raw body
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.sendStatus(400);
    }
    
    const session = event.data.object;

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const { organizationId, userId } = session.metadata;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        const planId = subscription.items.data[0].price.id;
        const planKey = Object.keys(PLANS).find(key => PLANS[key].priceId === planId);
        
        if (planKey) {
            const planDetails = PLANS[planKey];
            await Organization.findByIdAndUpdate(organizationId, {
                plan: planKey,
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                planLimits: planDetails.limits, // IMPORTANT: Update plan limits
            });
            // Notify the user of the successful upgrade
            await createNotification(userId, organizationId, 'plan_upgrade', `Your organization has been successfully upgraded to the ${planDetails.name} plan.`, '/settings/billing');
        }
    }
    
    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const organization = await Organization.findOne({ subscriptionId: subscription.id });

        if (organization) {
            // Revert to starter plan on cancellation
            const newPlanKey = subscription.cancel_at_period_end ? organization.plan : 'starter';
            const newPlanDetails = PLANS[newPlanKey];

            organization.subscriptionStatus = subscription.status;
            organization.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            
            // If subscription is truly canceled (not just set to cancel at period end), revert plan
            if(subscription.status === 'canceled') {
                 organization.plan = 'starter';
                 organization.planLimits = PLANS.starter.limits;
            }

            await organization.save();
        }
    }
    
    res.status(200).json({ received: true });
});

module.exports = {
    getPlans,
    createCheckoutSession,
    getCustomerPortal,
    handleStripeWebhook
};