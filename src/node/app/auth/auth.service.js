const pool = require('../../core/database/mysql-config.js');
const bcrypt = require('bcryptjs');
const PASSWORD_FIELD = process.env.DB_USER_PASSWORD_FIELD || 'password';

const SQL_LOGIN = `
  SELECT 
    u.nombre,
    u.${PASSWORD_FIELD} AS password_hash,
    u.rol_id,
    u.id AS id_usuario,
    u.fabricante_id AS fabid,
    u.establecimiento_id,
    e.id AS id_empresa,
    e.razonSocial,
    e.logo,
    e.extra_report,
    u.rank,
    u.alias,
    u.vnro,
    e.contrato,
    u.region,
    e.plan,
    u.mail,
    u.enabled,
    u.accountNonExpired,
    u.accountNonLocked,
    u.credentialsNonExpired
  FROM usuario u
  INNER JOIN empresa e ON u.empresa_id = e.id
  WHERE u.nombre = ?
  LIMIT 1
`;

async function loginPorNombre(nombre, passwordPlano) {
  const [rows] = await pool.query(SQL_LOGIN, [nombre]);
  if (!rows.length) return null;
  const u = rows[0];

  // Si tenés flags de estado, validalos
  if (u.enabled === 0 || u.accountNonExpired === 0 || u.accountNonLocked === 0 || u.credentialsNonExpired === 0) {
    return null;
  }

  // Normaliza hashes estilo PHP ($2y$ -> $2a$) si hace falta
  let hash = u.password_hash || '';
  if (hash.startsWith('$2y$')) hash = '$2a$' + hash.slice(4);

  const ok = await bcrypt.compare(String(passwordPlano), hash);
  if (!ok) return null;

  delete u.password_hash;
  return u;
}

module.exports = { loginPorNombre };