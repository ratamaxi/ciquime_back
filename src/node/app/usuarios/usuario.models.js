const { Schema, model } = require('mongoose');

const UsuarioSchema = Schema({
  id: { type: Number, required: true },
  fecha_delete: { type: Date },
  fecha_insert: { type: Date },
  fecha_update: { type: Date },
  version: { type: Number },
  accountNonExpired: { type: Boolean, required: true },
  accountNonLocked: { type: Boolean },
  credentialsNonExpired: { type: Boolean },
  enabled: { type: Boolean },
  token_pass: { type: String },
  pass_request: { type: Number },
  password: { type: String, required: true },
  nombre: { type: String, required: true },
  rol_id: { type: Number },
  UFdsUpdated: { type: Date },
  empresa_id: { type: Number },
  UFdsValid: { type: Date },
  UFds: { type: String },
  mail: { type: String },
  establecimiento_id: { type: Number },
  fabricante_id: { type: Number },
  rank: { type: Number }
});

UsuarioSchema.methods.toJSON = function () {
  const { __v, ...object } = this.toObject();
  return object;
};

module.exports = model('Usuario', UsuarioSchema);
