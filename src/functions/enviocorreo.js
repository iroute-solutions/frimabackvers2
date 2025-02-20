// const { app } = require("@azure/functions");
// const axios = require("axios");

// const {
//   createTransaccion,
//   getDocumentoSalidaTra,
//   addTrxDocOut,
//   create_OneId,
//   getPlantillasXDocOut,
//   updatePlantilla,
//   createDocSalida,
//   createDocEntrada,
//   insertTokenCliente,
//   getOne,
//   createDocumento,
// } = require("./databaseEnvioCorreo");

// // Función para enviar el correo mediante POST request
// async function PostClientMail(url, nombre, link, correo) {
//   const reqData = {
//     email: correo,
//     link: link,
//     nombre: nombre,
//   };

//   try {
//     // Realizamos la solicitud POST
//     const response = await axios.post(url, reqData, {
//       headers: {
//         "Content-Type": "application/json",
//         Host: "prod-54.eastus2.logic.azure.com:443", // Ajusta este header si es necesario
//       },
//     });

//     // Devolvemos el mensaje de la respuesta
//     return response.statusText;
//   } catch (error) {
//     console.error("Error al enviar el correo:", error.message);
//     return `Error: ${error.message}`;
//   }
// }

// // Controlador de transacción para prueba
// app.http("transaccionPrueba", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   route: "transaccion/trx/prueba",
//   handler: async (request, context) => {
//     //* METODO printTrans EN JAVA TransaccionService
//     const { idDocSalida, nombCorreo, correo } = await request.json();
//     const ipAddress = request.headers["X-Client-Ip"];
//     const clienteUri = "https://csclienteone.z20.web.core.windows.net/?";
//     const url = "a";
//     // const url =
//     ("https://prod-54.eastus2.logic.azure.com:443/workflows/7dae5f1a845b45bf94b9dfcfa7886e72/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ytPDcje6l9rA3oYtoKs0uxLF-w1-i4MZ4FINrZWh0cw");
//     // Validación de los campos obligatorios
//     if (!idDocSalida || !nombCorreo || !correo) {
//       return {
//         status: 400,
//         body: JSON.stringify({
//           message: "Debes de ingresar todos los parámetros",
//         }),
//       };
//     }

//     const respuesta = {
//       message: "",
//       message2: "",
//       status: "",
//       value: "0",
//       token: "",
//       tramite: 0,
//       trasaccion: 0,
//       documento: 0,
//       idTransaccion: 0,
//     };

//     try {
//       // Crear la transacción
//       const trx = {
//         nombre: "",
//         descripcion: "",
//         codigoRef: "",
//         estado: "A",
//         emiteSMS: 0,
//         emiteCorreo: 0,
//         emiteNoRepudio: 0,
//         usuarioAsocia: "PRUEBA",
//         usuarioModif: "PRUEBA",
//       };
//       //TODO ok
//       const idTransaccion = await createTransaccion(trx);
//       respuesta.idTransaccion = idTransaccion;
//       if (idTransaccion === 0) {
//         respuesta.message = "Error al Crear la Transacción";
//       } else if (idTransaccion === -1) {
//         respuesta.message = "Error en la conexión a la base";
//       } else {
//         // Obtener el documento de salida
//         //TODO ok
//         const documentoSalida = await getDocumentoSalidaTra(idDocSalida);
//         context.log("DocumentoSalida", documentoSalida);
//         // Agregar el documento de salida a la transacción
//         const docTrx = {
//           idTransaccion,
//           orden: 1,
//           documentoId: documentoSalida.id,
//           cliente: "NATURAL",
//           producto: "FIRMA DIGITAL",
//           segmento: "FIRMA DIGITAL",
//           subproducto: "",
//           canal: "FIRMA DIGITAL",
//           impDocSali: "",
//           cliNuevo: "",
//           flagDoc: "",
//           idBanco: "",
//         };
//         //TODO ok
//         const idTrxSalida = await addTrxDocOut(docTrx);

//         if (idTrxSalida === 0) {
//           respuesta.message = "Error al Crear el DocumentoTransaccionSalida";
//         } else if (idTrxSalida === -1) {
//           respuesta.message = "Error en la conexión a la base";
//         } else {
//           // Crear el trámite
//           const tramite = {
//             noRepudio: "0",
//             aprobadoCorrier: "0",
//             origen_datos: "FIRMA DIGITAL",
//             orderid: "1",
//           };
//           //todo ok
//           const idTramite = await create_OneId(tramite);
//           respuesta.tramite = idTramite;

//           if (idTramite === 0) {
//             respuesta.message = "Error al Crear el Trámite";
//           } else if (idTramite === -1) {
//             respuesta.message = "Error en la conexión a la base";
//           } else {
//             // Obtener y actualizar la plantilla
//             //TODO ok
//             const plantilla = await getPlantillasXDocOut(documentoSalida.id);
//             const idPlantilla = plantilla.id;
//             plantilla.estado = "E";

//             //TODO ok
//             const updatePlantillaResult = await updatePlantilla(plantilla);

//             // Crear el documento temporal de salida
//             const docTemTrx = {
//               idTramite,
//               contenido: plantilla.contenido,
//               idTransaccion,
//               orden: 0,
//               idPlantilla,
//               leido: "0",
//               nombre: plantilla.nombre,
//               impDocSali: "",
//               estado: "A",
//               flagdoc: "0",
//             };
//             //TODO ok
//             const result = await createDocSalida(docTemTrx);

//             // Crear los documentos temporales de entrada
//             const docEntTrx = {
//               capturado: "0",
//               idTramite,
//               idTransaccion,
//               tipoPersona: "TITULAR",
//               ruta: "/procesos/documentos/temporales/",
//               modoCaptura: "DISPOSITIVO",
//             };
//             let docSalida;
//             for (let i = 0; i <= 3; i++) {
//               if (i === 0) docEntTrx.nombre = "FIRMA";
//               else if (i === 1) docEntTrx.nombre = "VIDEO DE ACEPTACION";
//               else if (i === 2)
//                 docEntTrx.nombre = "IDENTIFICACION ANVERSO TITULAR";
//               else if (i === 3)
//                 docEntTrx.nombre = "IDENTIFICACION REVERSO TITULAR";
//               //TODO ok
//               docSalida = await createDocEntrada(docEntTrx); // Llamada a createDocEntrada
//             }

//             // Insertar el token de cliente
//             if (result !== "1" && result === "") {
//               respuesta.message =
//                 "Error al Crear el DocumentoTransaccionSalida";
//             } else {
//               // Insertar el token de cliente
//               //TODO ok
//               const token = await insertTokenCliente(nombCorreo);
//               if (!token) {
//                 respuesta.message = "Error al Crear el Token";
//               } else {
//                 const linkCliente = `${clienteUri}token=${token}&tramite=${idTramite}`;

//                 // Intentamos enviar el correo
//                 try {
//                   console.log("PostClientMail url:", url);
//                   console.log("PostClientMail nombre:", nombCorreo);
//                   console.log("PostClientMail urlCliente:", linkCliente);
//                   console.log("PostClientMail correo:", correo);

//                   //TODO ok
//                   const emailMessage = await PostClientMail(
//                     url,
//                     nombCorreo,
//                     linkCliente,
//                     correo
//                   );
//                   respuesta.message2 = emailMessage; // Mensaje devuelto por la función de envío de correo
//                 } catch (error) {
//                   console.error("Error al enviar el correo:", error);
//                 }

//                 // Guardamos el token generado y el enlace del cliente
//                 respuesta.token = linkCliente;

//                 //TODO ok
//                 const session = await getOne("", ipAddress);
//                 const userAD = session ? session.usuario : "desconocido";

//                 // Ahora procedemos a crear un documento
//                 const agencia = "";
//                 const identificacion = "99999999";
//                 const servicio = "99999999";
//                 const cuenta = "1.111111";
//                 const producto = "MOVIL";
//                 const estado = "CREADO";
//                 const canal = "CAC";
//                 const tipoPersona = "NATURAL";
//                 const medio = "FIRMA DIGITAL";
//                 const documentoFind = {
//                   agencia,
//                   canal,
//                   idTramite: idTramite,
//                   correo,
//                   cuenta,
//                   estado,
//                   fechaDoc: new Date().toISOString(),
//                   expira: "",
//                   fechaExpiracion: "",
//                   rutaRef: "/procesos/documentos/temporales/",
//                   identificacion,
//                   nomCliente: nombCorreo,
//                   producto,
//                   servicio,
//                   documento: plantilla.nombre, // Aquí usamos el nombre de la plantilla creada
//                   tipoDocumento: "SALIDA",
//                   codOrden: "",
//                   tipoPersona,
//                   usuario: userAD,
//                   idtransacc: idTransaccion.toString(),
//                   userCS: userAD,
//                   idOnBase: "1",
//                   medio,
//                   origen_datos: medio,
//                 };

//                 // Creación del documento
//                 //todo ok
//                 result = await createDocumento(documentoFind);

//                 // Creamos más documentos si es necesario
//                 for (let j = 0; j <= 3; j++) {
//                   if (j === 0) documentoFind.documento = "FIRMA";
//                   else if (j === 1)
//                     documentoFind.documento = "VIDEO DE ACEPTACION";
//                   else if (j === 2)
//                     documentoFind.documento = "IDENTIFICACION ANVERSO TITULAR";
//                   else if (j === 3)
//                     documentoFind.documento = "IDENTIFICACION REVERSO TITULAR";

//                   documentoFind.tipoDocumento = "ENTRADA"; // Cambiamos a tipo "ENTRADA"
//                   //todo ok
//                   result = await createDocumento(documentoFind); // Llamada a crear el documento
//                 }

//                 respuesta.message = "Operación realizada satisfactoriamente.";
//                 respuesta.status = "OK";
//               }
//             }
//           }
//         }
//       }
//     } catch (error) {
//       respuesta.message = `Error: ${error.message}`;
//     }

//     return {
//       status: 200,
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(respuesta),
//     };
//   },
// });
