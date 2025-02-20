const hashUtils = require('./hashPassword');
const roleUtils = require('./selectedRol');

module.exports = {
    ...hashUtils,
    ...roleUtils
};