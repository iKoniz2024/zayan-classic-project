const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(401).send({
                message: "Unauthorized"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).send({
            message: "Invalid or expired token"
        });
    }
};

const verifyOptionalToken = (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;
        next();

    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = verifyToken;
module.exports.verifyOptionalToken = verifyOptionalToken;