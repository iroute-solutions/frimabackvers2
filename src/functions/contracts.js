const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
require("dotenv").config();

const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}
AWS.config.update(awsConfig);
const dynamoDB = new AWS.DynamoDB.DocumentClient();

//TODO: listado de contratos
app.http("integracion_listarContratos", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const empresaID = request.query.get("empresaID")
            if (!empresaID) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Falta el ID de la empresa.",
                    }),
                };
            }

            const params = {
                TableName: 'ContratosFirmas', // Nombre de tu tabla de contratos
                FilterExpression: 'PK = :empresaID AND begins_with(SK, :skPrefix)', // Filtra por el cliente
                ExpressionAttributeValues: {
                    ':empresaID': empresaID,
                    ':skPrefix': 'CONTRACT#', // Tipo de contrato
                },
            };
            const result = await dynamoDB.scan(params).promise();
            if (!result.Items || result.Items.length === 0) {
                return {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "No se encontraron contratos con la empresa.",
                    }),
                };
            }

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Contratos encontrados.",
                    data: result.Items,
                }),
            };
        } catch (error) {
            console.error('Error al realizar la consulta:', error);
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Error durante la busqueda de contratos.",
                }),
            };
        }
    }
});
//TODO: guardar contrato || incluyendo anexos
app.http("integracion_guardarContrato", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, _) => {
        try {
            const {
                anexos,
                empresaID,
                titulo,
                descripcion,
                contratoID,
                contractDetails,
                version
            } = await request.json();

            const params = {
                //* CONTRATO
                TableName: "ContratosFirmas",
                Item: {
                    PK: empresaID,
                    SK: contratoID,
                    Anexos: anexos,
                    creado_en: new Date().toISOString(),
                    titulo, descripcion,
                    version,
                    contractDetails
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)", // Garantiza que la cédula no exista
            }

            // Guardar el usuario en DynamoDB
            await dynamoDB.put(params).promise();

            return {
                status: 201,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Contrato registrado con éxito.",
                }),
            };
        } catch (error) {
            console.log("Error!: " + error);
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Error al guardar el contrato.",
                }),
            }
        }
    }
});

//* listar contrato por ID
app.http("integracion_listarContratoPorID", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, _) => {
        try {
            const empresaID = request.query.get("empresaID");
            const contratoID = request.query.get("contratoID");

            if (!empresaID || !contratoID) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Falta el ID de la empresa o el ID del contrato.",
                    }),
                };
            }

            const params = {
                TableName: 'ContratosFirmas',
                Key: {
                    PK: empresaID,
                    SK: contratoID,
                },
            };
            const result = await dynamoDB.get(params).promise();
            console.log(result);
            if (!result.Item) {
                return {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "No se encontró el contrato.",
                        empresaID,
                        contratoID
                    }),
                };
            }

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Contrato encontrado.",
                    data: result.Item,
                }),
            };
        } catch (error) {
            console.error('Error al realizar la consulta:', error);
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Error durante la busqueda de contratos.",
                }),
            };
        }
    }
});

//TODO: editar contrato??? => solo los que no se encuentren firmados
//TODO: añadir firmante

//TODO: realizar firma || envio de correo