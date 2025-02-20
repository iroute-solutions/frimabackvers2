const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const { awsConfig } = require("../../awsConfig");
const { hashPassword } = require("../utils");
require("dotenv").config();
AWS.config.update(awsConfig);
const dynamoDB = new AWS.DynamoDB.DocumentClient();

//* guardar firmante 
app.http("integracion_guardarFirmante", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const {
                empresaId,
                firmanteId,
                nombre,
                apellidos,
                email,
                password } = await request.json();

            if (
                !empresaId ||
                !firmanteId ||
                !nombre ||
                !apellidos ||
                !email ||
                !password
            ) {
                return {
                    status: 400,
                    headers: {
                    "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                    message: "Faltan campos obligatorios.",
                    }),
                };
            }
            const passwordEncrypted = await hashPassword(password);
            const params = {
                TableName: 'EmpresaUsuariosFirma',
                Item: {
                    PK: empresaId,
                    SK: `USER#${firmanteId}`,
                    nombre,
                    apellidos_representante: apellidos,
                    identificacion: firmanteId,
                    password: passwordEncrypted,
                    email,
                    rol: "ROL#FIRMANTE",
                    Tipo: "usuario_firmante",
                    createdAt: new Date().toISOString()
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)", // Garantiza que la cédula no exista
            };

            await dynamoDB.put(params).promise();

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Firmante guardado correctamente.",
                }),
            }
        } catch (error) {
            console.error('Error al guardar el firmante:', error);

            if (error.code === "ConditionalCheckFailedException") {
                return {
                    status: 409,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Usuario ya se encuentra registrado.",
                    }),
                };
            }

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al guardar el firmante.",
                    details: error.message,
                }),
            }
        }
    }
});

//* listar firmantes
app.http("integracion_listarFirmantes", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const empresaId = request.query.get("empresaId");
           
            if (!empresaId) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Faltan campos obligatorios.",
                    }),
                };
            }

            // FilterExpression: 'Tipo = :tipo',
            // ':tipo': 'usuario_firmante'
            const params = {
                TableName: 'EmpresaUsuariosFirma',
                FilterExpression: 'PK = :empresaId AND begins_with(SK, :userPrefix) AND Tipo = :tipo',
                ExpressionAttributeValues: {
                    ':empresaId': empresaId,
                    ':userPrefix': 'USER#',
                    ':tipo': 'usuario_firmante'
                }
            }

            const { Items } = await dynamoDB.scan(params).promise();
            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(Items),
            };
        } catch (error) {
            console.error('Error al listar los firmantes:', error);
            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al listar los firmantes.",
                    details: error.message,
                }),
            };
        }
    }
});

//* combo firmantes
app.http("integracion_listarFirmantesCombo", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            const empresaId = request.query.get("empresaId");
           
            if (!empresaId) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Faltan campos obligatorios.",
                    }),
                };
            }

            const params = {
                TableName: 'EmpresaUsuariosFirma',
                FilterExpression: 'PK = :empresaId AND begins_with(SK, :userPrefix) AND Tipo = :tipo',
                ExpressionAttributeValues: {
                    ':empresaId': empresaId,
                    ':userPrefix': 'USER#',
                    ':tipo': 'usuario_firmante'
                }
            }

            const { Items } = await dynamoDB.scan(params).promise();
            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(Items.map( i => {
                    return {
                        label: `${i.nombre} ${i.apellidos_representante}`,
                        value: i.SK
                    }
                })),
            };
        } catch (error) {
            console.error('Error al listar los firmantes:', error);
            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al listar los firmantes.",
                    details: error.message,
                }),
            };
        }
    }
});