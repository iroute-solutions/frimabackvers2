const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const saltRounds = 10; // Número de rondas para generar el "salt"
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

async function comparePassword(password, hashedPassword) {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
}

module.exports  = {
    hashPassword,
    comparePassword
}