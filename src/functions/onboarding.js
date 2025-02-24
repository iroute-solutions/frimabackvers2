const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
require("dotenv").config();
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}
const jwt = require('jsonwebtoken');
const { hashPassword, selectedRol, comparePassword } = require("../utils");

// Configurar AWS SDK con las credenciales quemadas
AWS.config.update(awsConfig);
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const JWT_SECRET = "KeyToken"; // Cambiar por una clave segura y almacenar en variables de entorno
const JWT_EXPIRES_IN = "1h";

//* Endpoint para registrar cliente empresa|canal
app.http("integracion_registroCliente", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
        // Leer el cuerpo de la solicitud
        const {
            razon_social,
            identificacion_empresa,
            type, //* canal, empresa
            nombre_empresa, //*canal|empresa
            nombres_representante,
            apellidos_representante,
            email_representante,
            identificacion_representante,
            password,
        } = await request.json();

        const createdAt = new Date((new Date()).getTime() - 5 * 60 * 60 * 1000).toISOString();

        // Validar campos obligatorios
        if (
            !razon_social ||
            !identificacion_empresa ||
            !type ||
            !nombre_empresa ||
            !nombres_representante ||
            !apellidos_representante ||
            !email_representante ||
            !identificacion_representante ||
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

        const rol = selectedRol( type );
        const passwordEncrypted = await hashPassword( password );

        const params = {
            TransactItems: [
                {
                    //* CLIENTE/EMPRESA/CANAL
                    Put: {
                        TableName: "EmpresaUsuariosFirma",
                        Item: {
                            PK: `CLIENTE#${identificacion_empresa}`,
                            SK: `METADATA#${identificacion_empresa}`,
                            Tipo: type,
                            razon_social,
                            nombre: nombre_empresa,
                            identificacion: identificacion_empresa,
                            createdAt
                        },
                        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)", // Garantiza que la cédula no exista
                    }
                },
                {
                    //* REPRESENTANTE LEGAL 
                    Put: {
                        TableName: "EmpresaUsuariosFirma",
                        Item: {
                            PK: `CLIENTE#${identificacion_empresa}`,
                            SK: `USER#${identificacion_representante}`,
                            Tipo: `usuario_${ type.toLocaleLowerCase() }`,
                            nombre: nombres_representante,
                            apellidos_representante,
                            identificacion: identificacion_representante,
                            password: passwordEncrypted,
                            email: email_representante,
                            rol,
                            createdAt
                        },
                        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)", // Garantiza que la cédula no exista
                    }
                }
            ]
        }

        // Guardar el usuario en DynamoDB
        await dynamoDB.transactWrite(params).promise();

        return {
        status: 201,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: "Usuario registrado con éxito.",
            }),
        };
    } catch (err) {
        console.log("Error al registrar usuario:", err);

        // Manejar error de condición (cédula ya existe)
        if (err.code === "ConditionalCheckFailedException") {
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
                message: "Hubo un error al registrar el usuario.",
                details: err.message,
            }),
        };
    }
  },
});

//* Endpoint para loguear al usuario
app.http("integracion_loginCliente", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            // Leer el cuerpo de la solicitud
            const { documento_identidad, password } = await request.json();
            // Validar campos obligatorios
            if ( !documento_identidad || !password) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Faltan campos obligatorios: cédula, identificacion de la empresa y contraseña.",
                    }),
                };
            }

            //* Buscar al usuario en DynamoDB
            const params = {
                TableName: "EmpresaUsuariosFirma",
                FilterExpression: "SK = :sk",
                ExpressionAttributeValues: {
                    ":sk": `USER#${documento_identidad}`
                }
            };

            const { Items } = await dynamoDB.scan(params).promise();
            const user = Items[0]; //? mejorar
            // Verificar si el usuario existe
            if (!Items ) {
                return {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Credenciales incorrectas.",
                    }),
                };
            }


            if ( !comparePassword( password , user.password ) ) {
                return {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Credenciales incorrectas.",
                    }),
                };
            }

            // Generar el token JWT
            const token = jwt.sign(
                {
                    identificacion_empresa: user.PK.replace("CLIENTE#", ""),
                    documento_identidad: user.identificacion,
                    email: user.email,
                    nombres: `${ user.nombre } ${ user.apellidos_representante }`,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );
            
            // Si la autenticación es exitosa
            return {
                status: 200,
                headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Inicio de sesión exitoso.",
                    usuario: {
                        identificacion_empresa: user.PK.replace("CLIENTE#", ""),
                        documento_identidad: user.identificacion,
                        email: user.email,
                        nombre_completo: `${user.nombre} ${ user.apellidos_representante }`,
                        nombres: user.nombres,
                        apellidos_representante: user.apellidos_representante,
                    },
                    token,
                }),
            };
        } catch (err) {
            console.error("Error en el login de usuario", err);

            return {
                status: 500,
                headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify({
                message: "Hubo un error al iniciar sesión.",
                details: err.message,
                }),
            };
        }
    }
});

//* Endpoint obtener el valor del token
app.http("integracion_getUserLogged", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            // Leer el token de la solicitud
            let headers = [];
            for (const [key, value] of request.headers.entries()) {
                headers[key] = value
            }
            const { authorization } = headers;
            const token = authorization.split(" ")[1];

            // Verificar si el token es válido
            const decoded = jwt.verify(token, JWT_SECRET);

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Usuario autenticado.",
                    usuario: decoded,
                }),
            };
        } catch (err) {
            console.error("Error al obtener el usuario autenticado", err);

            return {
                status: 401,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Token inválido.",
                }),
            };
        }
    }
});

//* encriptar contraseña
app.http("integracion_encriptarPassword", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            // Leer el cuerpo de la solicitud
            const { password } = await request.json();

            // Validar campos obligatorios
            if (!password) {
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Falta el campo password.",
                    }),
                };
            }

            const passwordEncrypted = await hashPassword(password);

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Contraseña encriptada.",
                    passwordEncrypted,
                }),
            };
        } catch (err) {
            console.error("Error al encriptar la contraseña", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al encriptar la contraseña.",
                    details: err.message,
                }),
            };
        }
    }
});