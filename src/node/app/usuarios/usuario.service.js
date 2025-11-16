const Usuario = require("./usuario.models.js");

const buscarUsuario = async (user, password) => {
    try {
        user = (user ?? '').trim().toLowerCase();
        password = (password ?? '').trim();
        return await Usuario.findOne({user: user, password: password});
    } catch (error) {
        console.log(error);
        throw new Error(`Error al intentar obtener el usuario: ${error.message}`);
    }
};

module.exports = {
    buscarUsuario
};