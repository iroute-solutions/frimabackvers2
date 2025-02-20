const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
const { awsConfig } = require("../../awsConfig");
const { v4: uuidv4 } = require("uuid"); // Importar uuid
const jwt = require('jsonwebtoken');
require("dotenv").config();

const API_KEY_UANATACA = process.env.API_KEY_UANATACA;
const API_URL_UNATACA = process.env.API_URL_UNATACA;

// Configurar AWS SDK con las credenciales quemadas
AWS.config.update(awsConfig);
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const JWT_SECRET = "KeyToken"; // Cambiar por una clave segura y almacenar en variables de entorno
const JWT_EXPIRES_IN = "1h";


// Endpoint para registrar usuarios
app.http("integracion_registroUsuario", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const {
        cedula,
        email,
        nombres,
        apellido_paterno,
        apellido_materno,
        contrasena,
      } = await request.json();

      // Validar campos obligatorios
      if (!cedula || !email || !nombres || !apellido_paterno || !contrasena) {
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

      // Crear el objeto para guardar en DynamoDB
      const params = {
        TableName: "Firmas",
        Item: {
          PK: `USUARIO#${cedula}`,
          SK: "DETALLE",
          Tipo: "Usuario",
          email,
          nombres,
          apellido_paterno,
          apellido_materno: apellido_materno || null,
          contrasena, //TODO IMPORTANTE: Encriptar contraseñas en producción
        },
        ConditionExpression: "attribute_not_exists(PK)", // Garantiza que la cédula no exista
      };

      // Guardar el usuario en DynamoDB
      await dynamoDB.put(params).promise();

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

// Endpoint para iniciar sesión
app.http("integracion_loginUsuario", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const { cedula, contrasena } = await request.json();

      // Validar campos obligatorios
      if (!cedula || !contrasena) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Faltan campos obligatorios: cédula y contraseña.",
          }),
        };
      }

      // Buscar al usuario en DynamoDB
      const params = {
        TableName: "Firmas",
        Key: {
          PK: `USUARIO#${cedula}`,
          SK: "DETALLE",
        },
      };

      const result = await dynamoDB.get(params).promise();

      // Verificar si el usuario existe
      if (!result.Item) {
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

      if (result.Item.contrasena !== contrasena) {
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
          cedula: result.Item.PK.replace("USUARIO#", ""),
          email: result.Item.email,
          nombres: result.Item.nombres,
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
            cedula: result.Item.PK.replace("USUARIO#", ""),
            email: result.Item.email,
            nombres: result.Item.nombres,
            apellido_paterno: result.Item.apellido_paterno,
            apellido_materno: result.Item.apellido_materno || "",
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
  },
});

// Endpoint para obtener todos los usuarios
app.http("integracion_obtenerUsuarios", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Parámetros para escanear la tabla y obtener solo usuarios
      const params = {
        TableName: "Firmas",
        FilterExpression: "Tipo = :tipo",
        ExpressionAttributeValues: {
          ":tipo": "Usuario",
        },
      };

      const result = await dynamoDB.scan(params).promise();

      // Verificar si hay usuarios
      if (!result.Items || result.Items.length === 0) {
        return {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "No se encontraron usuarios.",
          }),
        };
      }

      // Devolver la lista de usuarios
      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Usuarios obtenidos con éxito.",
          usuarios: result.Items.map((item) => ({
            cedula: item.PK.replace("USUARIO#", ""),
            email: item.email,
            nombres_completos:
              item.nombres +
              " " +
              item.apellido_paterno +
              " " +
              (item.apellido_materno || ""), // Reemplazar null con cadena vacía
            nombres: item.nombres,
            apellido_paterno: item.apellido_paterno,
            apellido_materno: item.apellido_materno || "",
          })),
        }),
      };
    } catch (err) {
      console.error("Error al obtener usuarios:", err);

      return {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hubo un error al obtener usuarios.",
          details: err.message,
        }),
      };
    }
  },
});

// Endpoint para registrar o editar plantillas
app.http("integracion_registrarPlantilla", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const { motivo, plantilla_html } = await request.json();

      // Validar campos obligatorios
      if (!motivo || !plantilla_html) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Faltan campos obligatorios: motivo y plantilla_html.",
          }),
        };
      }

      // Generar id_plantilla en el backend
      const id_plantilla = uuidv4();
      // Obtener la fecha y hora actual en formato ISO
      const fecha_creacion = new Date((new Date()).getTime() - 5 * 60 * 60 * 1000).toISOString();

      // Registro de nueva plantilla
      const params = {
        TableName: "Firmas",
        Item: {
          PK: `PLANTILLA#${id_plantilla}`,
          SK: "DETALLE",
          Tipo: "Plantilla",
          motivo,
          plantilla_html,
          fecha_creacion,
        },
        ConditionExpression: "attribute_not_exists(PK)", // Garantiza que no se sobrescriba una existente
      };

      // Guardar la plantilla en DynamoDB
      await dynamoDB.put(params).promise();

      return {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantilla registrada con éxito.",
          id_plantilla,
        }),
      };
    } catch (err) {
      const isConditionalCheckFailed =
        err.code === "ConditionalCheckFailedException";

      return {
        status: isConditionalCheckFailed ? 409 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: isConditionalCheckFailed
            ? "La plantilla ya existe."
            : "Hubo un error al registrar la plantilla.",
          details: err.message,
        }),
      };
    }
  },
});

app.http("integracion_editarPlantilla", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const { id_plantilla, motivo, plantilla_html } = await request.json();

      // Validar campos obligatorios
      if (!id_plantilla || !motivo || !plantilla_html) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Faltan campos obligatorios: id_plantilla, motivo y plantilla_html.",
          }),
        };
      }

      // Edición de una plantilla existente
      const params = {
        TableName: "Firmas",
        Key: {
          PK: `PLANTILLA#${id_plantilla}`,
          SK: "DETALLE",
        },
        UpdateExpression:
          "SET motivo = :motivo, plantilla_html = :plantilla_html",
        ExpressionAttributeValues: {
          ":motivo": motivo,
          ":plantilla_html": plantilla_html,
        },
        ConditionExpression: "attribute_exists(PK)", // Garantiza que la plantilla exista
      };

      // Actualizar la plantilla en DynamoDB
      await dynamoDB.update(params).promise();

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantilla actualizada con éxito.",
          id_plantilla,
        }),
      };
    } catch (err) {
      const isConditionalCheckFailed =
        err.code === "ConditionalCheckFailedException";

      return {
        status: isConditionalCheckFailed ? 404 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: isConditionalCheckFailed
            ? "La plantilla no existe."
            : "Hubo un error al actualizar la plantilla.",
          details: err.message,
        }),
      };
    }
  },
});

// Endpoint para recuperar una plantilla por ID
app.http("integracion_obtenerPlantillaById", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "integracion_obtenerPlantillaById/{id?}", // Definimos la ruta para aceptar el ID como parámetro
  handler: async (request, context) => {
    try {
      // Leer el ID de la plantilla desde los parámetros de la URL
      const id_plantilla = request.params.id;

      // Validar que se haya proporcionado el ID
      if (!id_plantilla) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "El parámetro 'id_plantilla' es obligatorio.",
          }),
        };
      }

      // Parámetros para obtener la plantilla
      const params = {
        TableName: "Firmas",
        Key: {
          PK: `PLANTILLA#${id_plantilla}`,
          SK: "DETALLE",
        },
      };

      const result = await dynamoDB.get(params).promise();

      // Verificar si se encontró la plantilla
      if (!result.Item) {
        return {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "La plantilla no existe.",
          }),
        };
      }

      // Devolver la plantilla encontrada
      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantilla obtenida con éxito.",
          plantilla: {
            id_plantilla: id_plantilla,
            motivo: result.Item.motivo,
            plantilla_html: result.Item.plantilla_html,
            sign_key: result.Item.sign_key || null, // Si está vinculada a una firma
            estado: result.Item.estado || null, // Estado del proceso de firma (si aplica)
            documentofirmado: result.Item.documentofirmado || null, // Documento firmado (si aplica)
            identificacion_cliente: result.Item.identificacion_cliente || null, // Identificación del cliente (si aplica)
          },
        }),
      };
    } catch (err) {
      console.error("Error al obtener la plantilla:", err);

      return {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hubo un error al obtener la plantilla.",
          details: err.message,
        }),
      };
    }
  },
});

// Endpoint para listar todas las plantillas
app.http("integracion_listarTodasLasPlantillas", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Parámetros para escanear la tabla y obtener solo plantillas
      const params = {
        TableName: "Firmas",
        FilterExpression: "Tipo = :tipo",
        ExpressionAttributeValues: {
          ":tipo": "Plantilla",
        },
      };

      // Escanear la tabla
      const result = await dynamoDB.scan(params).promise();

      // Mapear las plantillas
      const plantillas = result.Items.map((item) => ({
        id_plantilla: item.PK.replace("PLANTILLA#", ""),
        motivo: item.motivo,
        plantilla_html: item.plantilla_html,
        sign_key: item.sign_key || null, // Si está vinculada a una firma
        estado: item.estado || null, // Estado del proceso de firma (si aplica)
        documentofirmado: item.documentofirmado || null, // Documento firmado (si aplica)
        identificacion_cliente: item.identificacion_cliente || null, // Identificación del cliente (si aplica)
        fecha_creacion: item.fecha_creacion || null, // Fecha de la creacion (si aplica)
      }));

      // Verificar si hay plantillas
      if (plantillas.length === 0) {
        return {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "No se encontraron plantillas.",
          }),
        };
      }

      // Respuesta exitosa con las plantillas
      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantillas obtenidas con éxito.",
          plantillas,
        }),
      };
    } catch (err) {
      console.error("Error al listar plantillas:", err);

      return {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hubo un error al listar plantillas.",
          details: err.message,
        }),
      };
    }
  },
});

// Endpoint para vincular firma a una plantilla
app.http("integracion_vincularFirma", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const { sign_key, id_plantilla, estado, identificacion_cliente } =
      await request.json();
      
      // Validar campos obligatorios
      if (!sign_key || !id_plantilla || !estado || !identificacion_cliente) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Faltan campos obligatorios: sign_key, id_plantilla, estado.",
          }),
        };
      }

      // Actualizar la plantilla con los datos de la firma
      const actualizarPlantillaParams = {
        TableName: "Firmas",
        Key: {
          PK: `PLANTILLA#${id_plantilla}`,
          SK: "DETALLE",
        },
        UpdateExpression:
          "SET sign_key = :sign_key, estado = :estado, identificacion_cliente = :identificacion_cliente",
        ExpressionAttributeValues: {
          ":sign_key": sign_key,
          ":estado": estado,
          ":identificacion_cliente": identificacion_cliente,
        },
        ConditionExpression: "attribute_exists(PK)", // Garantiza que la plantilla exista
      };

      // Actualizar la plantilla en DynamoDB
      await dynamoDB.update(actualizarPlantillaParams).promise();

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantilla actualizada con éxito.",
          plantilla: {
            id_plantilla,
            sign_key,
            estado,
          },
        }),
      };
    } catch (err) {
      console.error("Error al vincular la firma:", err);
      
      // Manejo de errores específicos
      const isConditionalCheckFailed =
      err.code === "ConditionalCheckFailedException";
      
      return {
        status: isConditionalCheckFailed ? 404 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: isConditionalCheckFailed
            ? "La plantilla no existe."
            : "Hubo un error al vincular la firma.",
          details: err.message,
        }),
      };
    }
  },
});

// Endpoint para actualizar los campos de estado y documentofirmado
app.http("integracion_actualizarEstadoPlantilla", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Leer el cuerpo de la solicitud
      const { sessionId, flowId, transactionId, files } = await request.json();
      
      // Validar campos obligatorios
      if (!sessionId || !flowId || !transactionId || !files) {
        return {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Faltan campos obligatorios: sessionId, flowId, transactionId, files.",
            }),
        };
      }

      // Procesar cada archivo en la matriz "files"
      const processedFiles = files.map((file) => {
        if (!file.fileName || !file.filePath || !file.signedTS) {
          throw new Error(
            `El archivo está incompleto. Se requieren: fileName, filePath y signedTS.`
          );
        }
        // Procesamiento adicional si es necesario
        return {
          fileName: file.fileName,
          filePath: file.filePath,
          signedTS: file.signedTS
        };
      });

      // Buscar el id_plantilla correspondiente al sessionId
      const paramsQuery = {
        TableName: "Firmas",
        FilterExpression: "sign_key = :sign_key AND Tipo = :tipo",
        ExpressionAttributeValues: {
          ":sign_key": sessionId,
          ":tipo": "Plantilla",
        },
      };

      // Obtener la plantilla por su sessionid
      const result = await dynamoDB.scan(paramsQuery).promise();

      if (!result.Items || result.Items.length === 0) {
        return {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Plantilla no encontrada." }),
        };
      }

      const plantilla = result.Items[0];
      const id_plantilla = plantilla.PK.replace("PLANTILLA#", "");
      const documentofirmado = files[0].filePath;
      const estado = "finished";

      // Parámetros para actualizar la plantilla
      const params = {
        TableName: "Firmas",
        Key: {
          PK: `PLANTILLA#${id_plantilla}`,
          SK: "DETALLE",
        },
        UpdateExpression:
          "SET estado = :estado, documentofirmado = :documentofirmado",
        ExpressionAttributeValues: {
          ":estado": estado,
          ":documentofirmado": documentofirmado,
        },
        ConditionExpression: "attribute_exists(PK)", // Garantiza que la plantilla exista
      };
      
      // Actualizar los campos en DynamoDB
      await dynamoDB.update(params).promise();

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Plantilla actualizada con éxito.",
          plantilla: {
            id_plantilla,
            estado,
            documentofirmado,
          },
        }),
      };
    } catch (err) {
      // console.error("Error al actualizar la plantilla:", err);
      context.log(`[ERROR] Error al actualizar la plantilla: ${err.message}`);

      // Manejo de errores específicos
      const isConditionalCheckFailed =
      err.code === "ConditionalCheckFailedException";

      return {
        status: isConditionalCheckFailed ? 404 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: isConditionalCheckFailed
            ? "La plantilla no existe."
            : "Hubo un error al actualizar la plantilla.",
            details: err.message,
          }),
      };
    }
  },
});

// TODO PAGINAR RESPUESTAS.
app.http( "integracion_firma_documentos_con_estado", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async( request, context ) => {
      try{
        const params = {
          TableName: "Firmas",
          FilterExpression: "Tipo = :tipo",
          ExpressionAttributeValues: {
            ":tipo": "Plantilla",
          },
        };
  
        // Escanear la tabla
        const result = await dynamoDB.scan(params).promise();
  
        // Mapear las plantillas
        const plantillas = result.Items.map((item) => ({
          id_plantilla: item.PK.replace("PLANTILLA#", ""),
          motivo: item.motivo,
          plantilla_html: item.plantilla_html,
          sign_key: item.sign_key || null, // Si está vinculada a una firma
          estado: item.estado || null, // Estado del proceso de firma (si aplica)
          documentofirmado: item.documentofirmado || null, // Documento firmado (si aplica)
          identificacion_cliente: item.identificacion_cliente || null, // Identificación del cliente (si aplica)
          fecha_creacion: item.fecha_creacion || null, // Fecha de la creacion (si aplica)
          file_path: null,
        }));
  
        //* Verificar si hay plantillas
        if (plantillas.length === 0) {
          return {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: "No se encontraron plantillas.",
            }),
          };
        }

        let allDocsWithStates = [];
        await Promise.allSettled(
          plantillas.map( ({ sign_key }) => fetch(
            `${API_URL_UNATACA}wf/flow-files/${sign_key}`,
            {
              headers: {
                "x-nexxit-key": API_KEY_UANATACA
              }
            }
          ).then( res => res.json() ))
        ).then( result => {
          //* recorro uno a uno la plantilla
          allDocsWithStates = plantillas.map(p => {
            const matchedResult = result.find(r => 
              r.status === "fulfilled" && r.value.status === 200 && 
              r.value.details.sessionId === p.sign_key
            );
            if (matchedResult) {
              return {
                ...p,
                estado: matchedResult.value.details.st, // Nuevo estado
                file_path: matchedResult.value.details?.files[0]?.signedB64 || null
              };
            }

            return {
              ...p,
              estado: 'Sin estado'
            };
          });
        });


        return {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: ".",
            plantillas: allDocsWithStates,
          })
        }

      }catch( e ){
        console.error("Error al listar plantillas:", err);

        return {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Hubo un error al listar plantillas.",
            details: err.message,
          }),
        };
      }
    }
  },
);