export const selectedRol = ( type = "") => {
    switch( type ){
        case 'superusuario':
            return "ROL#SUPERUSUARIO"
        case 'empresa':
            return "ROL#EMPRESA"
        case 'canal':
            return "ROL#CANAL"
        case 'firmante':
            return "ROL#FIRMANTE"
        default:
            return "ROL#DESCONOCIDO"
    }
}