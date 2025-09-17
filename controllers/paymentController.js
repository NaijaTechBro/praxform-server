

// const asyncHandler = require('express-async-handler');
// const Organization = require('../models/Organization');
// const createNotification = require('../utils/createNotification');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// // --- PLAN DEFINITIONS ---
// const PLANS = {
//     starter: {
//         name: 'Starter',
//         priceId: 'price_1S8IcXFnPEdPZtOZOKjBDgTE',
//         price: 0,
//         frequency: '/year',
//         limits: { maxTeamMembers: 1, maxForms: 5, maxSubmissionsPerMonth: 50, maxTemplates: 3, },
//         features: [ '1 team member', '50 submissions per month', '5 forms', '3 Custom templates creation', ],
//     },
//     pro: {
//         name: 'Pro',
//         priceId: 'price_1S8IbiFnPEdPZtOZSdfqfHri',
//         price: 49,
//         frequency: '/year',
//         limits: { maxTeamMembers: 5, maxForms: 20, maxSubmissionsPerMonth: 1000, maxTemplates: 5, },
//         features: [ '5 team members', '1,000 submissions per month', '20 forms', '5 custom templates', 'Create Forms Using AI', 'Webhooks & Zapier', 'Conditional Fields', 'Digital Signatures', ],
//     },
//     business: {
//         name: 'Business',
//         priceId: 'price_1S8Ie5FnPEdPZtOZbiju1yg2',
//         price: 99,
//         frequency: '/year',
//         limits: { maxTeamMembers: 20, maxForms: 100, maxSubmissionsPerMonth: -1, maxTemplates: 20, },
//         features: [ '20 team members', 'Unlimited submissions', '100 forms', '20 custom templates', 'All Pro features', 'Stripe Integration', 'PDF Generator', 'User Registration Forms', 'Custom App (API Access)', ],
//     },
// };

// const getPlans = asyncHandler(async (req, res) => {
//     res.status(200).json({
//         success: true,
//         data: Object.values(PLANS)
//     });
// });

// const createCheckoutSession = asyncHandler(async (req, res) => {
//     const { priceId } = req.body;
//     const userId = req.user._id;
//     const organizationId = req.user.currentOrganization;

//     const plan = Object.values(PLANS).find(p => p.priceId === priceId);
//     if (!plan) {
//         res.status(400);
//         throw new Error('Invalid plan selected.');
//     }

//     const organization = await Organization.findById(organizationId);
//     if (!organization) {
//         res.status(404);
//         throw new Error('Organization not found.');
//     }

//     let customerId = organization.customerId;
//     if (!customerId) {
//         const customer = await stripe.customers.create({
//             email: req.user.email,
//             name: organization.name,
//             metadata: {
//                 organizationId: organizationId.toString(),
//             },
//         });
//         customerId = customer.id;
//         organization.customerId = customerId;
//         await organization.save();
//     }

//     const session = await stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         mode: 'subscription',
//         customer: customerId,
//         line_items: [{
//             price: priceId,
//             quantity: 1
//         }],
//         success_url: `${process.env.CLIENT_URL}/settings/billing?success=true`,
//         cancel_url: `${process.env.CLIENT_URL}/settings/billing?canceled=true`,
//         metadata: {
//             organizationId: organizationId.toString(),
//             userId: userId.toString()
//         }
//     });

//     res.status(200).json({ success: true, url: session.url });
// });

// const getCustomerPortal = asyncHandler(async (req, res) => {
//     const organizationId = req.user.currentOrganization;
//     const organization = await Organization.findById(organizationId);

//     if (!organization || !organization.customerId) {
//         res.status(400);
//         throw new Error('No subscription found for this organization.');
//     }

//     const portalSession = await stripe.billingPortal.sessions.create({
//         customer: organization.customerId,
//         return_url: `${process.env.CLIENT_URL}/settings/billing`,
//     });

//     res.status(200).json({ success: true, url: portalSession.url });
// });

// const handleStripeWebhook = asyncHandler(async (req, res) => {
//     const signature = req.headers['stripe-signature'];
//     let event;

//     try {
//         event = stripe.webhooks.constructEvent(
//             req.body,
//             signature,
//             process.env.STRIPE_WEBHOOK_SECRET
//         );
//     } catch (err) {
//         console.error(`Webhook signature verification failed: ${err.message}`);
//         return res.sendStatus(400);
//     }
    
//     const session = event.data.object;

//     if (event.type === 'checkout.session.completed') {
//         const { organizationId, userId } = session.metadata;
//         const subscription = await stripe.subscriptions.retrieve(session.subscription);
//         const planId = subscription.items.data[0].price.id;
//         const planKey = Object.keys(PLANS).find(key => PLANS[key].priceId === planId);
        
//         if (planKey) {
//             const planDetails = PLANS[planKey];
//             await Organization.findByIdAndUpdate(organizationId, {
//                 plan: planKey,
//                 subscriptionId: subscription.id,
//                 subscriptionStatus: subscription.status,
//                 currentPeriodEnd: new Date(subscription.current_period_end * 1000),
//                 planLimits: planDetails.limits,
//             });
//             await createNotification(userId, organizationId, 'plan_upgrade', `Your organization has been successfully upgraded to the ${planDetails.name} plan.`, '/settings/billing');
//         }
//     }
    
//     if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
//         const subscription = event.data.object;
//         const organization = await Organization.findOne({ subscriptionId: subscription.id });

//         if (organization) {
//             if(subscription.status === 'canceled' || !subscription.cancel_at_period_end) {
//                  organization.plan = 'starter';
//                  organization.planLimits = PLANS.starter.limits;
//                  organization.subscriptionStatus = subscription.status === 'canceled' ? 'canceled' : 'active'; // keep 'active' if they just undo cancellation
//             } else {
//                  organization.subscriptionStatus = 'active_until_period_end'; // Custom status
//             }
//             organization.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
//             await organization.save();
//         }
//     }
    
//     res.status(200).json({ received: true });
// });

// module.exports = {
//     getPlans,
//     createCheckoutSession,
//     getCustomerPortal,
//     handleStripeWebhook // This export is now used by server.js
// };


const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');
const createNotification = require('../utils/createNotification');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- PLAN DEFINITIONS (NOW THE SINGLE SOURCE OF TRUTH) ---
const PLANS = {
    starter: {
        name: 'Starter',
        priceId: 'price_1S8IcXFnPEdPZtOZOKjBDgTE',
        description: 'Full-featured form builder to create beautiful forms for all needs.', // Added for UI
        price: 0,
        frequency: '/year',
        priceDetails: 'Yearly', // Added for UI
        isRecommended: false, // Added for UI
        originalPrice: null, // Added for UI
        monthlyOption: null, // Added for UI
        limits: { maxTeamMembers: 1, maxForms: 5, maxSubmissionsPerMonth: 50, maxTemplates: 3, },
        features: [ '1 team member', '50 submissions per month', '5 forms', '3 Custom templates creation', ],
    },
    pro: {
        name: 'Pro',
        priceId: 'price_1S8IbiFnPEdPZtOZSdfqfHri', // Your real Pro Price ID
        description: 'All features to build advanced forms and elevate your business.', // Added for UI
        price: 49,
        frequency: '/year',
        priceDetails: 'Yearly', // Added for UI
        isRecommended: false, // Added for UI
        originalPrice: null, // Added for UI
        monthlyOption: null, // Added for UI
        limits: { maxTeamMembers: 5, maxForms: 20, maxSubmissionsPerMonth: 1000, maxTemplates: 5, },
        features: [ '5 team members', '1,000 submissions per month', '20 forms', '5 custom templates', 'Create Forms Using AI', 'Webhooks & Zapier', 'Conditional Fields', 'Digital Signatures', ],
    },
    business: {
        name: 'Business',
        priceId: 'price_1S8Ie5FnPEdPZtOZbiju1yg2', // Your real Business Price ID
        description: 'For anyone who wants to transform their clients productivity and impress their clients.', // Added for UI
        price: 99,
        frequency: '/year',
        priceDetails: 'Yearly', // Added for UI
        originalPrice: '$150', // Added for UI
        monthlyOption: 'or 11 x $13.6/mo **', // Added for UI
        isRecommended: true, // Added for UI
        limits: { maxTeamMembers: 20, maxForms: 100, maxSubmissionsPerMonth: -1, maxTemplates: 20, },
        features: [ '20 team members', 'Unlimited submissions', '100 forms', '20 custom templates', 'All Pro features', 'Stripe Integration', 'PDF Generator', 'User Registration Forms', 'Custom App (API Access)', ],
    },
};

const getPlans = asyncHandler(async (req, res) => {
    // This now sends the complete plan objects to the frontend
    res.status(200).json({
        success: true,
        data: Object.values(PLANS)
    });
});

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
        metadata: {
            organizationId: organizationId.toString(),
            userId: userId.toString()
        }
    });

    res.status(200).json({ success: true, url: session.url });
});

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

const handleStripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.sendStatus(400);
    }
    
    const session = event.data.object;

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
                planLimits: planDetails.limits,
            });
            await createNotification(userId, organizationId, 'plan_upgrade', `Your organization has been successfully upgraded to the ${planDetails.name} plan.`, '/settings/billing');
        }
    }
    
    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const organization = await Organization.findOne({ subscriptionId: subscription.id });

        if (organization) {
            if(subscription.status === 'canceled' || (subscription.status === 'active' && !subscription.cancel_at_period_end)) {
                 organization.plan = 'starter';
                 organization.planLimits = PLANS.starter.limits;
                 organization.subscriptionStatus = subscription.status === 'canceled' ? 'canceled' : 'active';
            } else if (subscription.cancel_at_period_end) {
                 organization.subscriptionStatus = 'active_until_period_end'; // Custom status for UI
            }
            organization.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
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