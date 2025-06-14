import Order from "../models/Order.js";
import Product from "../models/Product.js";
import stripe from 'stripe'
import User from "../models/User.js";

//Place Order COD: /api/order/cod
export const placeOrderCOD = async (req, res) => {
    console.log("problem1")
    try {
        const { userId, items, address } = req.body;
        if (!address || items.length == 0) {
            return res.json({ success: false, message: "Invalid Data" })
        }
        //calculate about using items
        let amount = await items.reduce(async (acc, item) => {
            const product = await Product.findById(item.product);
            return (await acc) + product.offerPrice * item.quantity;
        }, 0)  // yha zero kyu?


        //Add tax 2%
        amount += Math.floor(amount * 0.02);

        await Order.create({
            userId,
            items,
            amount,
            address,
            paymentType: "COD",
        });

        return res.json({ success: true, message: "Order Placed Successfully" })
    } catch (error) {
        return res.json({ success: false, message: error.message })
    }
}


//PLACE ORDER COD: /api/order/stripe
// export const placeOrderStripe = async (req,res) =>{
//     try {
//         const {userId, items, address} = req.body;
//         const {origin} = req.headers;


//         if(!address || items.length == 0){
//             return res.json({success:false, message:"Invalid Data"})
//         }

//         let productData = [];

//         //calculate about using items
//         let amount = await items.reduce(async(acc,item)=>{
//             const  product = await Product.findById(item.product);
//             productData.push({
//                 name: product.name,
//                 price: product.offerPrice,
//                 quantity: item.quantity,
//             });
//             return (await acc) + product.offerPrice * item.quantity;
//         }, 0)  // yha zero kyu?


//         //Add tax 2%
//         amount += Math.floor(amount * 0.02);

//         const order = await Order.create({
//             userId,
//             items,
//             amount,
//             address,
//             paymentType: "Online",
//         });

//         // Stripe GateWay Initialize
//         const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
//         // Create line items for stripe
//         const line_items = productData.map((item)=>{
//             return {
//                 price_data: {
//                     currency: "inr",
//                     product_data:{
//                         name: item.name, 
//                     },
//                     unit_amount: (item.price + item.price*0.02) * 100
//                     // unit_amount: Math.round(((item.price * 1.02) + Number.EPSILON) * 100)
//                 },
//                 quantity: item.quantity,
//             }
//     })

//     // create session
//     const session = await stripeInstance.checkout.sessions.create({
//         line_items,
//         mode:"payment",
//         success_url: `${origin}/loader?next=my-orders`,
//         cancel_url: `${origin}/cart`,
//         metadata:{
//             orderId: order._id.toString(),
//             userId,

//         }
//     })

//         return res.json({success:true, url: session.url})
//     } catch (error) {
//         return res.json({success:false, message: error.message+"hi"})
//     }
// }

export const placeOrderStripe = async (req, res) => {
    try {
        const { userId, items, address } = req.body;
        const { origin } = req.headers;

        if (!address || items.length == 0) {
            return res.json({ success: false, message: "Invalid Data" });
        }

        let productData = [];
        let amount = 0; // Initialize as number

        // Calculate amount synchronously
        for (const item of items) {
            const product = await Product.findById(item.product);
            const itemTotal = product.offerPrice * item.quantity;
            productData.push({
                name: product.name,
                price: product.offerPrice,
                quantity: item.quantity,
            });
            amount += itemTotal;
        }

        // Add tax 2% and convert to paise (integer)
        const totalAmount = Math.round(amount * 1.02 * 100);

        const order = await Order.create({
            userId,
            items,
            amount: totalAmount / 100, // Store in rupees
            address,
            paymentType:"Online",
        });

        //stripe gateway initialize
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

        const line_items = productData.map((item) => {
            // Calculate per-item total with tax in paise
            const itemTotalWithTax = Math.round(item.price * item.quantity * 1.02 * 100);
            return {
                price_data: {
                    currency: "inr",
                    product_data: {
                        name: item.name,
                    },
                    unit_amount: Math.round(itemTotalWithTax / item.quantity) // Price per unit
                },
                quantity: item.quantity,
            };
        });

        const session = await stripeInstance.checkout.sessions.create({
            line_items,
            mode: "payment",
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            metadata: {
                orderId: order._id.toString(),
                userId,
            }
        });

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Stripe Error:", error);
        return res.json({
            success: false,
            message: "Payment processing failed. " + error.message
        });
    }
};

// Stripe Webhooks to Verify Payment Action : /stripe
export const stripeWebhooks = async (request, response) => {
    // stripe gateway initialize 
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

    const sig = request.headers["stripe-signature"];
    let event;
    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        response.status(400).send(`Webhook Error: ${error.message}`)
    }

    // Handle The Event 
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;

            //getting session metadata;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntentId,
            })

            const { orderId, userId } = session.data[0].metadata;

            // mark payment as paid

            await Order.findByIdAndUpdate(orderId, { isPaid: true });

            // clear user cart
            await User.findByIdAndUpdate(userId, { cartItems: {} });
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;

            //getting session metadata;
            const session = await stripeInstance.checkout.sessions.list({
                payment_intent: paymentIntentId,
            })

            const { orderId } = session.data[0].metadata;
            await Order.findByIdAndDelete(orderId);
            break;
        }
        default:
            console.error(`Unhandled Event Type ${event.type}`);
            break;
    }
    response.json({ received: true });
}


//Get Order by User ID : /api/order/user

export const getUserOrders = async (req, res) => {
    try {
        const { userId } = req.body;
        const orders = await Order.find({
            userId,
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}



// Get All orders (for seller /admin) : /api/order/seller
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [{ paymentType: "COD" }, { isPaid: true }]
        }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}