const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}
const jwt = require('jsonwebtoken');
require("dotenv").config();
AWS.config.update(awsConfig);
// dynamo tabla LogUsuariosFirmas a guardar datos
const dynamo = new AWS.DynamoDB.DocumentClient();

app.http("integracion_logUsuariosFirmas", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            /**
            *   PK: `CLIENTE#${empresaID}`,
                SK: `USER#${firmanteID}`,
                nombre: '',
                apellidos: '',
                correo:'',
                telefono:'',
                creado_en:'',
                contrato_id:''
            */
            const { empresaID, firmanteID, nombre, apellidos, correo, telefono, contrato_id } = await request.json();

            // Validar campos obligatorios
            if (!empresaID || !firmanteID || !nombre || !apellidos || !correo || !telefono || !contrato_id) {
                const missingFields = [];
                const requiredFields = [
                    { field: empresaID, name: "empresaID" },
                    { field: firmanteID, name: "firmanteID" },
                    { field: nombre, name: "nombre" },
                    { field: apellidos, name: "apellidos" },
                    { field: correo, name: "correo" },
                    { field: telefono, name: "telefono" },
                    { field: contrato_id, name: "contrato_id" },
                ];

                requiredFields.forEach(({ field, name }) => {
                    if (!field) missingFields.push(name);
                });


                if (missingFields.length > 0) {
                    return {
                        status: 400,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: `Faltan campos requeridos. Campos faltantes: ${missingFields.join(", ")}`,
                            missingFields,
                        }),
                    };

                }
            }

            // Guardar en la tabla de DynamoDB
            const params = {
                TableName: "LogUsuariosFirmas",
                Item: {
                    PK: `CLIENTE#${empresaID}`,
                    SK: `USER#${firmanteID}#${(new Date()).getTime() - 5 * 60 * 60 * 1000}`,
                    nombre,
                    apellidos,
                    correo,
                    telefono,
                    creado_en: new Date((new Date()).getTime() - 5 * 60 * 60 * 1000).toISOString(),
                    contrato_id: `CONTRACT#${contrato_id}`,
                },
            };

            const data = await dynamo.put(params).promise();

            return {
                status: 201,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Usuario firmante guardado correctamente",
                    data,
                }),
            };

        } catch (err) {
            console.error("Error en el registro del log", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Error al guardar el log de usuario firmante.",
                    details: err.message,
                }),
            };
        }
    }
});