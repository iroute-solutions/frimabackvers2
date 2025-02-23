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
                    creado_en: new Date((new Date()).getTime() - 5 * 60 * 60 * 1000).toISOString(),
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
                    message: "Contrato registrado con éxito."
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

// TODO: añadir ubicaciones de firmas y actualizar a pendiente
app.http("integracion_ubicacionFirmasyEstado", {
    methods: ["PATCH"],
    authLevel: "anonymous",
    handler: async( request, _ ) => {
        try {
            
            const {
                contrato_id,
                empresa_id,
                ubicacionFirmanteLegal,
                ubicacionFirmante
            } = await request.json();

            // Validar campos obligatorios
            if (!contrato_id || !empresa_id
                || !ubicacionFirmanteLegal || !ubicacionFirmante
            ) {
                const missingFields = [];
                const requiredFields = [
                    { field: contrato_id, name: "contrato_id" },
                    { field: empresa_id, name: "empresa_id" },
                    { field: ubicacionFirmanteLegal, name: "ubicacionFirmanteLegal" },
                    { field: ubicacionFirmante, name: "ubicacionFirmante" },
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

            const data = await dynamoDB.get(params).promise();
            const { contractDetails } = data.Item;

            // Cambiar el estado
            contractDetails.status = "pending";

            // Actualizar el contrato
            const updateParams = {
                TableName: "ContratosFirmas",
                Key: {
                    PK: `CLIENTE#${empresa_id}`,
                    SK: `CONTRACT#${contrato_id}`,
                },
                UpdateExpression: `
                    SET
                        contractDetails = :contractDetails,
                        ubicacion_firma_firmante = :firma, 
                        ubicacion_firma_firmante_legal = :firmaLegal
                `,
                ExpressionAttributeValues: {
                    ":contractDetails": contractDetails,
                    ":firmaLegal": ubicacionFirmanteLegal,
                    ":firma": ubicacionFirmante,
                },
            };

            await dynamoDB.update(updateParams).promise();

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

//TODO: editar contrato??? => solo los que no se encuentren firmados