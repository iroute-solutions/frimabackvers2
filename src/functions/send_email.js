const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const { awsConfig } = require("../../awsConfig");
const jwt = require('jsonwebtoken');
require("dotenv").config();

//* Send email
// app.http(async (req, res) => {
//     const { email, subject, message } = req.query;
//     const token = req.headers['x-functions-key'];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     if (decoded.email !== email) {
//         return res.status(401).json({ message: "Unauthorized" });
//     }

//     const ses = new AWS.SES(awsConfig);
//     const params = {
//         Destination: {
//             ToAddresses: [email],
//         },
//         Message: {
//             Body: {
//                 Text: {
//                     Charset: "UTF-8",
//                     Data: message,
//                 },
//             },
//             Subject: {
//                 Charset: "UTF-8",
//                 Data: subject,
//             },
//         },
//         Source: ""
//     };

//     try {
//         await ses.sendEmail(params).promise();
//         return res.status(200).json({ message: "Email sent" });
//     }
//     catch (error) {
//         return res.status(500).json({ message: "Internal server error" });
//     }
// });


