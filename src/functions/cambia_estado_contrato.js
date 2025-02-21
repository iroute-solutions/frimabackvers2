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

app.http("integracion_estadoContratoFirma", {
    methods: ["PATCH"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const { contrato_id, nuevo_estado, empresa_id } = await request.json();

            // Validar campos obligatorios
            if (!contrato_id || !nuevo_estado || !empresa_id) {
                const missingFields = [];
                const requiredFields = [
                    { field: contrato_id, name: "contrato_id" },
                    { field: nuevo_estado, name: "nuevo_estado" },
                    { field: empresa_id, name: "empresa_id" },
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
                TableName: "ContratosFirmas",
                Key: {
                    PK: `CLIENTE#${empresa_id}`, // Asegúrate de obtener empresaID
                    SK: `CONTRACT#${contrato_id}`
                }
            };

            const data = await dynamo.get(params).promise();
            const { contractDetails } = data.Item;

            // Cambiar el estado
            contractDetails.status = nuevo_estado;

            // Actualizar el contrato
            const updateParams = {
                TableName: "ContratosFirmas",
                Key: {
                    PK: `CLIENTE#${empresa_id}`,
                    SK: `CONTRACT#${contrato_id}`,
                },
                UpdateExpression: "set contractDetails = :contractDetails",
                ExpressionAttributeValues: {
                    ":contractDetails": contractDetails,
                },
            };

            await dynamo.update(updateParams).promise();

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Estado del contrato actualizado.",
                }),
            };
        } catch (err) {
            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Error al cambiar el estado del contrato.",
                    details: err.message,
                }),
            };
        }
    }
});