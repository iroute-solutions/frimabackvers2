const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const nodemailer = require("nodemailer");
const { PDFDocument } = require("pdf-lib");
require("dotenv").config();
AWS.config.update(awsConfig);
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3 = new AWS.S3();

app.http("integracion_anadirQR", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            /**
             * {
                    "url_contrato_s3": "",
                    "ubicaciones_firmas": {
                        "firmante_legal": {
                            "x": 560,
                            "y": 600,
                            "numero_pagina": 2,
                            "contenido_qr": "HOLA PRUEBA"
                        },
                        "firmante": {
                            "x": 560,
                            "y": 600,
                            "numero_pagina": 1,
                            "contenido_qr": "HOLA PRUEBA"
                        }
                    }
                }
             */

            // Validar campos obligatorios
            const { url_contrato_s3, ubicaciones_firmas, destinatario, asunto, mensaje } = await request.json();
            if (!url_contrato_s3 || !ubicaciones_firmas
                || !ubicaciones_firmas.firmante || !ubicaciones_firmas.firmante_legal
                || !ubicaciones_firmas.firmante.x || !ubicaciones_firmas.firmante.y
                || !ubicaciones_firmas.firmante.numero_pagina || !ubicaciones_firmas.firmante.contenido_qr
                || !ubicaciones_firmas.firmante_legal.x || !ubicaciones_firmas.firmante_legal.y
                || !ubicaciones_firmas.firmante_legal.numero_pagina
                || !ubicaciones_firmas.firmante_legal.contenido_qr
                || !destinatario || !asunto || !mensaje) {
                const missingFields = [];
                const requiredFields = [
                    { field: url_contrato_s3, name: "url_contrato_s3" },
                    { field: ubicaciones_firmas, name: "ubicaciones_firmas" },
                    { field: ubicaciones_firmas?.firmante, name: "ubicaciones_firmas.firmante" },
                    { field: ubicaciones_firmas?.firmante_legal, name: "ubicaciones_firmas.firmante_legal" },
                    { field: ubicaciones_firmas?.firmante?.x, name: "ubicaciones_firmas.firmante.x" },
                    { field: ubicaciones_firmas?.firmante?.y, name: "ubicaciones_firmas.firmante.y" },
                    { field: ubicaciones_firmas?.firmante?.numero_pagina, name: "ubicaciones_firmas.firmante.numero_pagina" },
                    { field: ubicaciones_firmas?.firmante?.contenido_qr, name: "ubicaciones_firmas.firmante.contenido_qr" },
                    { field: ubicaciones_firmas?.firmante_legal?.x, name: "ubicaciones_firmas.firmante_legal.x" },
                    { field: ubicaciones_firmas?.firmante_legal?.y, name: "ubicaciones_firmas.firmante_legal.y" },
                    { field: ubicaciones_firmas?.firmante_legal?.numero_pagina, name: "ubicaciones_firmas.firmante_legal.numero_pagina" },
                    { field: ubicaciones_firmas?.firmante_legal?.contenido_qr, name: "ubicaciones_firmas.firmante_legal.contenido_qr" },
                    { field: destinatario, name: "destinatario" },
                    { field: asunto, name: "asunto" },
                    { field: mensaje, name: "mensaje" },
                ];

                requiredFields.forEach(({ field, name }) => {
                    if (!field) missingFields.push(name);
                });

                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: `Faltan campos obligatorios: ${missingFields.join(", ")}.`,
                    }),
                }
            }

            // Validar que el destinatario sea un arreglo de correos
            if (!Array.isArray(destinatario)) {
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
            // Validar que los correos sean válidos
            destinatario.forEach((email) => {
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
            }
            );

            const bucketName = BUCKET_NAME;

            const params = {
                Bucket: bucketName,
                Key: url_contrato_s3
            };

            const data = await s3.getObject(params).promise();

            //obtendremos el contenido del archivo e inyectaremos el QR en la ubicación indicada
            const pdfDoc = await PDFDocument.load(data.Body);
            const pages = pdfDoc.getPages();

            if (ubicaciones_firmas.firmante.numero_pagina > pages.length) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "El número de página (firmante) no existe en el documento.",
                    }),
                }
            }
            if (ubicaciones_firmas.firmante_legal.numero_pagina > pages.length) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "El número de página (firmante legal) no existe en el documento.",
                    }),
                }
            }

            const qrFirmante = await QRCode.toBuffer(ubicaciones_firmas.firmante.contenido_qr, {
                errorCorrectionLevel: "H",
                version: 2,
                width: 100,
                margin: 1,
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
                type: "png",
            });

            const qrFirmanteLegal = await QRCode.toBuffer(ubicaciones_firmas.firmante_legal.contenido_qr, {
                errorCorrectionLevel: "H",
                version: 2,
                width: 100,
                margin: 1,
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
                type: "png",
            });


            const qrImageFirmante = await pdfDoc.embedPng(qrFirmante);
            const qrImageFirmanteLegal = await pdfDoc.embedPng(qrFirmanteLegal);
            const qrDimsFirmante = qrImageFirmante.scale(0.5);
            const qrDimsFirmanteLegal = qrImageFirmanteLegal.scale(0.5);

            // ubicaciones_firmas.firmante.x | ubicaciones_firmas.firmante.y | ubicaciones_firmas.firmante.numero_pagina
            const firmantePage = pages[ubicaciones_firmas.firmante.numero_pagina - 1];
            firmantePage.drawImage(qrImageFirmante, {
                x: ubicaciones_firmas.firmante.x,
                y: ubicaciones_firmas.firmante.y,
                width: qrDimsFirmante.width,
                height: qrDimsFirmante.height,
            });

            // ubicaciones_firmas.firmante_legal.x | ubicaciones_firmas.firmante_legal.y | ubicaciones_firmas.firmante_legal.numero_pagina
            const firmanteLegalPage = pages[ubicaciones_firmas.firmante_legal.numero_pagina - 1];
            firmanteLegalPage.drawImage(qrImageFirmanteLegal, {
                x: ubicaciones_firmas.firmante_legal.x,
                y: ubicaciones_firmas.firmante_legal.y,
                width: qrDimsFirmanteLegal.width,
                height: qrDimsFirmanteLegal.height,
            });

            const pdfBytes = await pdfDoc.save();
            const pdfBuffer = Buffer.from(pdfBytes);

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: true, // true for port 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            console.log("destinatario", destinatario);
            // Configure the mailoptions object
            const mailOptions = {
                from: 'alexanderaguayo43@gmail.com',
                to: destinatario,
                subject: asunto,
                html: `<p>${mensaje}</p>`,
                attachments: [
                    {
                        filename: 'documento-firmado.pdf',
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            };

            // Send the email
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



        } catch (err) {
            console.error("Error en la carga del documento", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al firmar o enviar el archivo.",
                    details: err.message,
                }),
            };
        }
    }
});