const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { sendMail } = require("../config/mail");
const { withCache, clearCache } = require("../utils/cache");
const { buildIdQuery } = require("../utils/buildIdQuery");

const createOrder = async (req, res) => {
    try {
        const { paymentMethod, shippingAddress, deliveryArea } = req.body;

        const db = getDB();

        const cartsCollection = db.collection("carts");
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        const cart = await cartsCollection.aggregate([
            {
                $match: {
                    userId: new ObjectId(req.user.id),
                },
            },
            {
                $unwind: "$items",
            },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product",
                },
            },
            {
                $unwind: "$product",
            },
            {
                $project: {
                    productId: "$product._id",
                    title: "$product.title",
                    thumbnail: { $ifNull: ["$items.colorImage", "$product.thumbnail"] },
                    price: "$product.price",
                    quantity: "$items.quantity",
                    size: "$items.size",
                    color: "$items.color",
                    colorImage: "$items.colorImage",
                    subtotal: {
                        $multiply: [
                            "$items.quantity",
                            "$product.price",
                        ],
                    },
                },
            },
        ]).toArray();

        if (!cart.length) {
            return res.status(400).send({
                message: "Cart is empty",
            });
        }

        for (const item of cart) {
            const product = await productsCollection.findOne({
                _id: item.productId,
            });

            if (!product) {
                return res.status(404).send({
                    message: `${item.title} not found`,
                });
            }

            if (
                product.stock === 0 ||
                product.availabilityStatus === "Out of Stock"
            ) {
                return res.status(400).send({
                    message: `${item.title} is out of stock`,
                });
            }

            if (item.quantity > product.stock) {
                return res.status(400).send({
                    message: `Only ${product.stock} ${item.title} available in stock`,
                });
            }
        }

        const totalItems = cart.reduce(
            (sum, item) => sum + item.quantity,
            0
        );

        const totalPrice = cart.reduce(
            (sum, item) => sum + item.subtotal,
            0
        );

        const FREE_SHIPPING_THRESHOLD = 1000;
        const SHIPPING_INSIDE_DHAKA = 60;
        const SHIPPING_OUTSIDE_DHAKA = 120;

        const isFreeShipping = totalPrice >= FREE_SHIPPING_THRESHOLD;
        const shippingCost = isFreeShipping ? 0 : (deliveryArea === "inside_dhaka" ? SHIPPING_INSIDE_DHAKA : SHIPPING_OUTSIDE_DHAKA);
        const grandTotal = totalPrice + shippingCost;

        const order = {
            userId: new ObjectId(req.user.id),
            items: cart,
            totalItems,
            subtotal: totalPrice,
            shippingCost,
            deliveryArea,
            totalPrice: grandTotal,
            shippingAddress,
            paymentMethod,
            paymentStatus: "pending",
            orderStatus: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await ordersCollection.insertOne(order);
        order._id = result.insertedId;

        await cartsCollection.deleteOne({
            userId: new ObjectId(req.user.id),
        });

        // Deduct product stock
        for (const item of cart) {
            if (item.productId) {
                const updatedProduct = await productsCollection.findOneAndUpdate(
                    { _id: new ObjectId(item.productId) },
                    { $inc: { stock: -item.quantity } },
                    { returnDocument: "after" }
                );
                if (updatedProduct && updatedProduct.stock <= 0) {
                    await productsCollection.updateOne(
                        { _id: new ObjectId(item.productId) },
                        { $set: { availabilityStatus: "Out of Stock", stock: 0 } }
                    );
                }
            }
        }

        clearCache();

        sendInvoiceEmail(order).catch((err) => console.error("Error sending invoice email:", err));

        res.status(201).send({
            message: "Order placed successfully",
            insertedId: result.insertedId,
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error",
        });
    }
};

const createGuestOrder = async (req, res) => {
    try {
        const { items, paymentMethod, shippingAddress, deliveryArea } = req.body;

        const db = getDB();
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        const cart = [];

        for (const item of items) {
            const product = await productsCollection.findOne({
                _id: new ObjectId(item.productId),
            });

            if (!product) {
                return res.status(404).send({
                    message: `Product not found`,
                });
            }

            if (product.stock === 0 || product.availabilityStatus === "Out of Stock") {
                return res.status(400).send({
                    message: `${product.title} is out of stock`,
                });
            }

            if (item.quantity > product.stock) {
                return res.status(400).send({
                    message: `Only ${product.stock} ${product.title} available in stock`,
                });
            }

            cart.push({
                productId: product._id,
                title: product.title,
                thumbnail: item.colorImage || item.thumbnail || product.thumbnail,
                price: product.price,
                quantity: item.quantity,
                size: item.size || "",
                color: item.color || "",
                colorImage: item.colorImage || "",
                subtotal: item.quantity * product.price,
            });
        }

        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.reduce((sum, item) => sum + item.subtotal, 0);

        const FREE_SHIPPING_THRESHOLD = 1000;
        const SHIPPING_INSIDE_DHAKA = 60;
        const SHIPPING_OUTSIDE_DHAKA = 120;

        const isFreeShipping = totalPrice >= FREE_SHIPPING_THRESHOLD;
        const shippingCost = isFreeShipping ? 0 : (deliveryArea === "inside_dhaka" ? SHIPPING_INSIDE_DHAKA : SHIPPING_OUTSIDE_DHAKA);
        const grandTotal = totalPrice + shippingCost;

        const order = {
            userId: null,
            guestPhone: shippingAddress.phone,
            guestEmail: shippingAddress.email,
            items: cart,
            totalItems,
            subtotal: totalPrice,
            shippingCost,
            deliveryArea,
            totalPrice: grandTotal,
            shippingAddress,
            paymentMethod,
            paymentStatus: "pending",
            orderStatus: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await ordersCollection.insertOne(order);
        order._id = result.insertedId;

        // Deduct product stock
        for (const item of cart) {
            if (item.productId) {
                const updatedProduct = await productsCollection.findOneAndUpdate(
                    { _id: new ObjectId(item.productId) },
                    { $inc: { stock: -item.quantity } },
                    { returnDocument: "after" }
                );
                if (updatedProduct && updatedProduct.stock <= 0) {
                    await productsCollection.updateOne(
                        { _id: new ObjectId(item.productId) },
                        { $set: { availabilityStatus: "Out of Stock", stock: 0 } }
                    );
                }
            }
        }

        clearCache();

        sendInvoiceEmail(order).catch((err) => console.error("Error sending invoice email:", err));

        res.status(201).send({
            message: "Order placed successfully",
            insertedId: result.insertedId,
            orderId: result.insertedId,
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error",
        });
    }
};

const trackOrder = async (req, res) => {
    try {
        const { orderId, phone } = req.body;

        if (!orderId && !phone) {
            return res.status(400).send({
                message: "Order ID or Phone Number is required",
            });
        }

        const db = getDB();
        const ordersCollection = db.collection("orders");

        let order = null;

        if (orderId) {
            // Try full ObjectId first
            try {
                order = await ordersCollection.findOne({
                    _id: new ObjectId(orderId),
                });
            } catch {
                // Not a valid ObjectId, try short ID match
            }

            // If not found, try matching by short ID (last 8 chars) directly in MongoDB
            if (!order && orderId && orderId.trim().length > 0) {
                const cleanShortId = orderId.trim().toUpperCase();
                try {
                    order = await ordersCollection.findOne({
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$_id" },
                                regex: new RegExp(cleanShortId + "$", "i")
                            }
                        }
                    });
                } catch {
                    // Fallback search
                }
            }

            if (!order) {
                return res.send({
                    notFound: true,
                    message: "Order not found",
                });
            }

            if (order.guestPhone && phone && order.guestPhone !== phone) {
                return res.status(403).send({
                    message: "Phone number does not match",
                });
            }
        } else if (phone) {
            const orders = await ordersCollection
                .find({
                    $or: [
                        { guestPhone: phone },
                        { "shippingAddress.phone": phone },
                    ],
                })
                .sort({ createdAt: -1 })
                .toArray();

            if (!orders.length) {
                return res.send({
                    notFound: true,
                    message: "Order not found",
                });
            }

            order = orders[0];
        }

        res.send(order);

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error",
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const db = getDB();

        const ordersCollection = db.collection("orders");

        const orders = await ordersCollection
            .find({
                userId: new ObjectId(req.user.id)
            })
            .project({
                orderStatus: 1,
                paymentMethod: 1,
                paymentStatus: 1,
                totalPrice: 1,
                totalItems: 1,
                deliveryArea: 1,
                shippingAddress: {
                    fullName: 1,
                    phone: 1,
                    address: 1
                },
                createdAt: 1,
                updatedAt: 1,
                items: {
                    $map: {
                        input: { $ifNull: ["$items", []] },
                        as: "item",
                        in: {
                            title: "$$item.title",
                            thumbnail: "$$item.thumbnail",
                            quantity: "$$item.quantity",
                            price: "$$item.price",
                            subtotal: "$$item.subtotal"
                        }
                    }
                }
            })
            .sort({
                createdAt: -1
            })
            .toArray();

        res.send({
            totalOrders: orders.length,
            orders
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const db = getDB();
        const ordersCollection = db.collection("orders");

        const page = req.query.page ? parseInt(req.query.page) : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        const status = req.query.status || "";

        const query = {};
        if (status && status !== "all") {
            query.orderStatus = status;
        }

        const cacheKey = `orders_${page}_${limit}_${status}`;
        const result = await withCache(cacheKey, 15, async () => {
            const listProjection = {
                orderStatus: 1,
                paymentMethod: 1,
                paymentStatus: 1,
                totalPrice: 1,
                totalItems: 1,
                deliveryArea: 1,
                shippingAddress: {
                    fullName: 1,
                    phone: 1,
                    address: 1
                },
                createdAt: 1,
                updatedAt: 1,
                items: {
                    $map: {
                        input: { $ifNull: ["$items", []] },
                        as: "item",
                        in: {
                            title: "$$item.title",
                            thumbnail: "$$item.thumbnail",
                            quantity: "$$item.quantity",
                            price: "$$item.price",
                            subtotal: "$$item.subtotal"
                        }
                    }
                }
            };

            if (page && limit) {
                const skip = (page - 1) * limit;
                const totalOrders = await ordersCollection.countDocuments(query);

                const orders = await ordersCollection
                    .find(query)
                    .project(listProjection)
                    .sort({
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                return {
                    totalOrders,
                    currentPage: page,
                    totalPages: Math.ceil(totalOrders / limit),
                    orders
                };
            } else {
                const orders = await ordersCollection
                    .find(query)
                    .project(listProjection)
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

                return {
                    totalOrders: orders.length,
                    orders
                };
            }
        });

        res.send(result);

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const getSingleOrder = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid order id"
            });
        }

        const db = getDB();
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!order) {
            return res.status(404).send({
                message: "Order not found"
            });
        }

        const isOwner = order.userId && order.userId.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).send({
                message: "Forbidden"
            });
        }

        res.send(order);

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid order id"
            });
        }

        const validStatuses = [
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
        ];

        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).send({
                message: "Invalid order status",
            });
        }

        const db = getDB();

        const ordersCollection = db.collection("orders");
        const productsCollection = db.collection("products");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!order) {
            return res.status(404).send({
                message: "Order not found",
            });
        }

        if (
            orderStatus === "delivered" &&
            order.orderStatus !== "delivered"
        ) {
            for (const item of order.items) {
                const product = await productsCollection.findOne({
                    _id: item.productId,
                });

                if (!product) {
                    return res.status(404).send({
                        message: `${item.title} not found`,
                    });
                }

                if (product.stock < item.quantity) {
                    return res.status(400).send({
                        message: `${item.title} is out of stock`,
                    });
                }

                const newStock = product.stock - item.quantity;

                await productsCollection.updateOne(
                    {
                        _id: item.productId,
                    },
                    {
                        $set: {
                            stock: newStock,
                            availabilityStatus:
                                newStock > 0
                                    ? "In Stock"
                                    : "Out of Stock",
                        },
                    }
                );
            }
        }

        await ordersCollection.updateOne(
            {
                _id: new ObjectId(id),
            },
            {
                $set: {
                    orderStatus,
                    updatedAt: new Date(),
                },
            }
        );

        clearCache();

        res.send({
            message: "Order status updated successfully",
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error",
        });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid order id"
            });
        }

        const db = getDB();
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(id)
        });

        if (!order) {
            return res.status(404).send({
                message: "Order not found"
            });
        }

        const isOwner = order.userId && order.userId.toString() === req.user.id;
        const isAdmin = req.user.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).send({
                message: "Forbidden"
            });
        }

        if (order.orderStatus !== "pending") {
            return res.status(400).send({
                message: "Only pending orders can be cancelled"
            });
        }

        await ordersCollection.updateOne(
            {
                _id: new ObjectId(id)
            },
            {
                $set: {
                    orderStatus: "cancelled",
                    updatedAt: new Date()
                }
            }
        );

        clearCache();

        res.send({
            message: "Order cancelled successfully"
        });

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const sendInvoiceEmail = async (order, targetEmail = null) => {
    const email = targetEmail || order.shippingAddress?.email || order.guestEmail || order.email;
    if (!email) {
        console.warn("No email address found for invoice on order:", order._id);
        return null;
    }

    const orderShortId = order._id?.toString().slice(-8).toUpperCase();
    const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString("en-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const shippingLabel = order.deliveryArea === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka";
    const postalLine = order.shippingAddress?.postalCode
        ? `${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`
        : order.shippingAddress?.city || "";

    const itemsHtml = (order.items || [])
        .map(
            (item, idx) => `
            <tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"};">
                <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">
                    <span style="font-weight:600;">${item.title}</span>${item.color ? `<br><span style="font-size:11px;color:#888;">Color: ${item.color}</span>` : ""}${item.size ? `<br><span style="font-size:11px;color:#888;">Size: ${item.size}</span>` : ""}
                </td>
                <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#555;">${item.quantity}</td>
                <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;color:#555;">৳${Number(item.price).toFixed(2)}</td>
                <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;">৳${Number(item.subtotal || item.price * item.quantity).toFixed(2)}</td>
            </tr>`
        )
        .join("");

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice #${orderShortId}</title>
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:#f0f2f5;color:#333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;">
            <tr>
                <td align="center" style="padding:30px 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                        <tr>
                            <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:32px 36px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Zayan Classic</h1>
                                            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;">Order Invoice</p>
                                        </td>
                                        <td align="right" valign="top">
                                            <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 16px;display:inline-block;">
                                                <span style="font-size:11px;color:rgba(255,255,255,0.5);display:block;text-transform:uppercase;letter-spacing:0.5px;">Invoice</span>
                                                <span style="font-size:16px;font-weight:700;color:#ffffff;">#${orderShortId}</span>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="background:#fafafa;border-bottom:1px solid #f0f0f0;padding:18px 36px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Date</td>
                                        <td align="right" style="font-size:13px;color:#555;font-weight:500;">${orderDate}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:32px 36px;">
                                <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Order Items</p>
                                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;border-collapse:separate;">
                                    <thead>
                                        <tr style="background:#1a1a1a;">
                                            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
                                            <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                                            <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
                                            <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>

                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                                    <tr>
                                        <td style="padding:10px 0;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="font-size:13px;color:#888;">Subtotal</td>
                                                    <td align="right" style="font-size:13px;color:#555;">৳${Number(order.subtotal).toFixed(2)}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:10px 0;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="font-size:13px;color:#888;">Shipping (${shippingLabel})</td>
                                                    <td align="right" style="font-size:13px;color:${order.shippingCost > 0 ? "#555" : "#22c55e"};font-weight:500;">${order.shippingCost > 0 ? "৳" + Number(order.shippingCost).toFixed(2) : "Free"}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:14px 0 0;border-top:2px solid #1a1a1a;margin-top:4px;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="font-size:16px;font-weight:700;color:#1a1a1a;">Total</td>
                                                    <td align="right" style="font-size:18px;font-weight:700;color:#1a1a1a;">৳${Number(order.totalPrice).toFixed(2)}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <div style="border-top:1px solid #f0f0f0;margin:32px 0;"></div>

                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%" valign="top" style="padding-right:20px;">
                                            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Shipping Address</p>
                                            <div style="background:#fafafa;border-radius:8px;padding:16px;border:1px solid #f0f0f0;">
                                                <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${order.shippingAddress?.fullName || ""}</p>
                                                <p style="margin:6px 0 0;font-size:13px;color:#666;line-height:1.7;">
                                                    ${order.shippingAddress?.phone || ""}<br>
                                                    ${order.shippingAddress?.address || ""}<br>
                                                    ${postalLine}
                                                </p>
                                            </div>
                                        </td>

                                        <td width="50%" valign="top" style="padding-left:20px;">
                                            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Payment Info</p>
                                            <div style="background:#fafafa;border-radius:8px;padding:16px;border:1px solid #f0f0f0;">
                                                <p style="margin:0 0 8px;font-size:13px;color:#666;">
                                                    <span style="color:#888;">Method:</span> <span style="font-weight:600;color:#333;text-transform:capitalize;">${order.paymentMethod || "N/A"}</span>
                                                </p>
                                                <p style="margin:0;font-size:13px;color:#666;">
                                                    <span style="color:#888;">Status:</span>
                                                    <span style="display:inline-block;background:${order.paymentStatus === "paid" ? "#dcfce7" : "#fef3c7"};color:${order.paymentStatus === "paid" ? "#16a34a" : "#d97706"};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-left:4px;text-transform:capitalize;">${order.paymentStatus || "pending"}</span>
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 36px;text-align:center;">
                                <p style="margin:0 0 4px;font-size:12px;color:#999;">Thank you for shopping with <strong style="color:#666;">Zayan Classic</strong></p>
                                <p style="margin:0;font-size:11px;color:#ccc;">If you have any questions, contact us at our support.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;

    return await sendMail({
        to: email,
        subject: `Invoice - Order #${orderShortId} | Zayan Classic`,
        html,
    });
};

const sendInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid order id"
            });
        }

        const db = getDB();
        const ordersCollection = db.collection("orders");

        let order;
        try {
            order = await ordersCollection.findOne({
                _id: new ObjectId(id),
            });
        } catch {
            return res.status(404).send({ message: "Order not found" });
        }

        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        const email = req.body?.email || order.shippingAddress?.email || order.guestEmail || order.email;
        if (!email) {
            return res.status(400).send({ message: "No email address found for this order" });
        }

        const mailResult = await sendInvoiceEmail(order, email);
        if (!mailResult) {
            return res.status(500).send({ message: "Failed to send invoice email via SMTP" });
        }

        res.send({ message: "Invoice sent successfully", mailResult });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to send invoice" });
    }
};
 
const getDashboardStats = async (req, res) => {
    try {
        const db = getDB();
        const result = await withCache("dashboardStats", 300, async () => {
            const productsCollection = db.collection("products");
            const categoriesCollection = db.collection("categories");
            const ordersCollection = db.collection("orders");

            const totalProducts = await productsCollection.estimatedDocumentCount();
            const totalCategories = await categoriesCollection.countDocuments();
            const totalOrders = await ordersCollection.countDocuments();

            const stats = await ordersCollection.aggregate([
                {
                    $facet: {
                        statusCounts: [
                            {
                                $group: {
                                    _id: "$orderStatus",
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        revenue: [
                            {
                                $match: {
                                    orderStatus: { $ne: "cancelled" }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: "$totalPrice" }
                                }
                            }
                        ]
                    }
                }
            ]).toArray();

            const facetResult = stats[0] || {};
            const ordersByStatus = {
                pending: 0,
                confirmed: 0,
                processing: 0,
                shipped: 0,
                delivered: 0,
                cancelled: 0
            };

            if (facetResult.statusCounts) {
                facetResult.statusCounts.forEach(item => {
                    const status = item._id || "pending";
                    ordersByStatus[status] = item.count;
                });
            }

            const totalRevenue = facetResult.revenue?.[0]?.total || 0;

            return {
                totalProducts,
                totalCategories,
                totalOrders,
                totalRevenue,
                ordersByStatus
            };
        });

        res.send(result);

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const ordersCollection = db.collection("orders");

        const result = await ordersCollection.deleteOne(buildIdQuery(id));

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Order not found" });
        }

        clearCache();
        res.send({ message: "Order deleted successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
    }
};

module.exports = {
    createOrder,
    createGuestOrder,
    trackOrder,
    getMyOrders,
    getAllOrders,
    getSingleOrder,
    updateOrderStatus,
    cancelOrder,
    sendInvoice,
    getDashboardStats,
    deleteOrder,
};