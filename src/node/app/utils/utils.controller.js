const { encryptIdCompat } = require('./crypto-legacy');

const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL || 'https://ciquime.com.ar';

function assertMateriaId(id) {
  if (!id || !/^\d+$/.test(String(id))) {
    const err = new Error('materiaId inválido');
    err.status = 400;
    throw err;
  }
}

async function redirectHSO(req, res) {
  try {
    const { materiaId } = req.params;
    assertMateriaId(materiaId);
    const idEnc = encryptIdCompat(materiaId);
    const url   = `${LEGACY_BASE_URL}/hs.php?id=${encodeURIComponent(idEnc)}`;
    return res.redirect(302, url);
  } catch (e) {
    console.error('[redirectHSO]', e);
    res.status(e.status || 500).json({ ok: false, message: e.message || 'Error HSO' });
  }
}

async function redirectFET(req, res) {
  try {
    const { materiaId } = req.params;
    assertMateriaId(materiaId);
    const idEnc = encryptIdCompat(materiaId);
    const url   = `${LEGACY_BASE_URL}/fie.php?id=${encodeURIComponent(idEnc)}`;
    return res.redirect(302, url);
  } catch (e) {
    console.error('[redirectFET]', e);
    res.status(e.status || 500).json({ ok: false, message: e.message || 'Error FET' });
  }
}

async function redirectFDS(req, res) {
  try {
    const { root, rfn } = req.query;
    if (!root) return res.status(400).json({ ok: false, message: 'root requerido' });
    const url = `${LEGACY_BASE_URL}/fdsdownload.php?root=${encodeURIComponent(root)}&rfn=${encodeURIComponent(rfn || '')}`;
    return res.redirect(302, url);
  } catch (e) {
    console.error('[redirectFDS]', e);
    res.status(500).json({ ok: false, message: 'Error FDS' });
  }
}

async function getEncryptedId(req, res) {
  try {
    const { materiaId } = req.params;
    assertMateriaId(materiaId);
    const idEnc = encryptIdCompat(materiaId);
    res.json({ ok: true, id_encrypt: idEnc });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || 'Error cifrando' });
  }
}

module.exports = { redirectHSO, redirectFET, redirectFDS, getEncryptedId };
