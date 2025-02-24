const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}
const nodemailer = require("nodemailer");
require("dotenv").config();

//* Send email
app.http("integracion_sendEmail",{
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (req, res) => {
        const { destinatarios, asunto, mensaje } = await req.json();
        // Validar que el destinatarios sea un arreglo de correos
        if (!Array.isArray(destinatarios)) {
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: `El campo destinatario debe ser un arreglo.`,
                }),
            };
        }
        const mailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        destinatarios.forEach((email) => {
            if (!mailRegex.test(email)) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: `El email ${email} no es válido.`,
                    }),
                };
            }
        });
        try {
            const mailOptions = {
                from: 'crhighlander94@gmail.com',
                // from: 'crhighlander94@gmail.com',//TODO AÑADIR EL CORREO DE LA EMPRESA
                to: destinatarios,
                subject: asunto,
                html: `<p>${mensaje}</p>`
            };

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: true, // true for port 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log('Error:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "El archivo fue firmado y enviado exitosamente.",
                }),
            };
        }
        catch (error) {
            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al enviar el correo.",
                    details: err.message,
                }),
            };
        }
    }
});