const { app } = require("@azure/functions");
const AWS = require("aws-sdk");
require("dotenv").config();
// TODO: NO UTILIZAR EL ARCHIVO awsConfig.js
// TODO: usar las variables de entorno de la función
// const { awsConfig } = require("../../awsConfig");
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
}

AWS.config.update(awsConfig);
const parseMultipartFormData = require("@anzp/azure-function-multipart").default;

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3 = new AWS.S3();


//* Leer documento del bucket
app.http("integracion_verDoc", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        try {
            //?"documentosIds/0943836478001/0943836478/1739481896374_documento-firmado.pdf";
            const url = request.query.get("url");
            const bucketName = BUCKET_NAME;

            const params = {
                Bucket: bucketName,
                Key: url
            };

            const data = await s3.getObject(params).promise();

            return {
                status: 200,
                headers: {
                    "Content-Type": data.ContentType,
                },
                body: data.Body,
            };
        } catch (err) {
            console.error("Error en la carga del documento", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al cargar el archivo.",
                    details: err.message,
                }),
            };
        }
    }
});

//!no se usa
//? no borrar
app.http("integracion_cargarDocID", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        const headers = {}
        let empresaId, firmanteId, carpeta;
        let locations = [];
        for (const [key, value] of request.headers.entries()) {
            headers[key] = value
        }
        const { files, fields } = await parseMultipartFormData(
            { ...request, body: Buffer.from(await request.arrayBuffer()) },
            { headers }
        );
        
        if (!headers['content-type'] || !headers['content-type'].includes('multipart/form-data')) {
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify( { name: "header no Compatible",...headers } ),
            };
        }

        if( !fields || !files ){
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Faltan campos obligatorios, { file, empresaId, clienteId }.",
                }),
            }
        }

        for( const file of files ){
            if( file.mimeType !== 'application/pdf'){
                return {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: "Solo debe subir archivos PDFs.",
                    }),
                }
            }
        }
        
        for( const field of fields ){
            const { name, value } = field;
            switch( name ){
                case 'empresaId':
                    empresaId = value;
                    break;
                case 'firmanteId':
                    firmanteId = value
                    break;
                case 'carpeta':
                    carpeta = value
                    break;
            }
        }
        try {
            
            const bucketName = BUCKET_NAME;
            for( const file of files ){
                const key = `${ carpeta }/${empresaId}/${firmanteId}/${ empresaId }_${ firmanteId }`;
                // Parámetros para la carga a S3
                const params = {
                    Bucket: bucketName,
                    Key: key,
                    Body: file.bufferFile, // Contenido del archivo
                    ContentType: file.mimeType // Tipo de contenido
                };

                const data = await s3.upload(params).promise();
                locations.push( data.Location );
            }

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: 'Archivo(s) subido correctamente.',
                    location: locations.map( e => e).join(" / "),
                    empresaId,
                    firmanteId
                }),
            }

        } catch (err) {
            context.error("Error en la carga del archivo", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al subir su archivo.",
                    details: err.message,
                }),
            };
        }
    }
});

//* Cargar documento(s) al bucket
app.http("integracion_cargarDocs", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (request, context) => {
        const headers = {}
        let requestLocations = [], mimeTypesAllowed = [];
        

        for (const [key, value] of request.headers.entries()) {
            headers[key] = value
        }

        const { files, fields } = await parseMultipartFormData(
            { ...request, body: Buffer.from(await request.arrayBuffer()) },
            { headers }
        );
        
        if (!headers['content-type'] || !headers['content-type'].includes('multipart/form-data')) {
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify( { name: "header no Compatible",...headers } ),
            };
        }

        if( !fields || !files ){
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Faltan campos obligatorios, { files, location }.",
                }),
            }
        }
        for( const field of fields ){
            const { name, value } = field;
            switch( name ){
                case 'locations':
                    requestLocations = JSON.parse(value);
                    break;
                case 'mimeTypesAllowed':
                    mimeTypesAllowed = JSON.parse(value);
                    break;
            }
        }

        const responseLocations = [ ...requestLocations ];

        if( requestLocations.length !== files.length ){
            return {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "La cantidad de archivos no coincide con la cantidad de ubicaciones.",
                }),
            }
        }

        if( mimeTypesAllowed.length !== 0 ){
            for( const file of files ){
                if( !mimeTypesAllowed.includes( file.mimeType ) ){
                    return {
                        status: 400,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: "Solo debe subir archivos PDFs.",
                        }),
                    }
                }
            }
        }
        
        try {
            const bucketName = BUCKET_NAME;
            for( const file of files ){
                const key = `${ requestLocations.shift() }`;
                // Parámetros para la carga a S3
                const params = {
                    Bucket: bucketName,
                    Key: key,
                    Body: file.bufferFile, // Contenido del archivo
                    ContentType: file.mimeType // Tipo de contenido
                };
                await s3.upload(params).promise();
            }

            return {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: 'Archivo(s) subido correctamente.',
                    locations: responseLocations,
                }),
            }

        } catch (err) {
            context.error("Error en la carga del archivo", err);

            return {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: "Hubo un error al subir su archivo.",
                    details: err.message,
                }),
            };
        }
    }
});