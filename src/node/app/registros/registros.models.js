const { Schema, model } = require('mongoose');

const RegistroDataSchema = Schema({});

RegistroDataSchema.methods.toJSON = function () {
  const { __v, ...object } = this.toObject();
  return object;
};

module.exports = model('Usuario', RegistroDataSchema);
