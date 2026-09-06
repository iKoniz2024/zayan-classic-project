const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

const verifyAdmin = async (req, res, next) => {
    try {
        const db = getDB();

        const usersCollection = db.collection("users");

        const user = await usersCollection.findOne({
            _id: new ObjectId(req.user.id)
        });

        if (!user) {
            return res.status(404).send({
                message: "User not found"
            });
        }

        if (user.role !== "admin") {
            return res.status(403).send({
                message: "Access denied. Admin only."
            });
        }

        next();

    } catch (error) {
        console.log(error);

        res.status(500).send({
            message: "Internal Server Error"
        });
    }
};

module.exports = verifyAdmin;