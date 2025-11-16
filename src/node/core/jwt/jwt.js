const jwt = require('jsonwebtoken');

const generarToken = (uid, email, id_empresa) => {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('Faltan JWT_SECRET o JWT_REFRESH_SECRET en las variables de entorno');
    }

    const payload = {uid, email, id_empresa};
    const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRATION});
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {expiresIn: process.env.JWT_REFRESH_EXPIRATION});
    return {token, refreshToken};
};

function validarToken(req, res, next) {
    try {
        const auth = req.header('Authorization')?.trim() || '';
        const [scheme, token] = auth.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ok: false, msj: 'Falta token Bearer'});
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.uid = payload.uid;
        req.user = payload;
        return next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ok: false, msj: 'Token expirado'});
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ok: false, msj: 'Token inválido'});
        }
        if (err.name === 'NotBeforeError') {
            return res.status(401).json({ok: false, msj: 'Token no activo aún'});
        }
        console.error('JWT verify error:', err);
        return res.status(401).json({ok: false, msj: 'No autorizado'});
    }
}

async function refresh(req, res) {
    try {
        const token = req.body?.refreshToken;
        if (!token) return res.status(400).json({ok: false, msj: 'Falta refreshToken'});
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const {token: access, refreshToken} = generarToken(payload.uid, payload.email, payload.id_empresa);
        return res.json({ok: true, token: access, refreshToken});
    } catch (err) {
        const msj = err.name === 'TokenExpiredError' ? 'Refresh expirado' : 'Refresh inválido';
        return res.status(401).json({ok: false, msj});
    }
}

module.exports = {
    generarToken,
    validarToken,
    refresh
};