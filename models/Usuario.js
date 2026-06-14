import { DataTypes } from "sequelize";
import bcrypt from "bcrypt";
import db from "../config/db.js";

// Modelo Usuario.
// Un modelo representa una tabla de la base de datos y sus columnas.
const Usuario = db.define(
  "Usuario",
  {
    // Nombre completo del usuario.
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Correo electronico del usuario.
    // Debe ser unico para evitar cuentas duplicadas.
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    // Password del usuario.
    // Al crear un usuario desde la aplicacion se cifra en el hook beforeCreate.
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Token que mas adelante podremos usar para confirmar cuenta
    // o recuperar password.
    token: {
      type: DataTypes.STRING,
    },

    // Indica si el usuario ya confirmo su cuenta.
    confirmado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    // Nombre real de la tabla en MySQL.
    tableName: "usuarios",

    // Los timestamps vienen de la configuracion global de Sequelize.
    // Sequelize agregara createdAt y updatedAt.

    // Hook que se ejecuta antes de crear un usuario.
    // Nunca debemos guardar passwords en texto plano.
    hooks: {
      beforeCreate: async (usuario) => {
        // bcrypt.genSalt crea una "sal" aleatoria.
        // Esa sal hace que dos passwords iguales generen hashes diferentes.
        const salt = await bcrypt.genSalt(10);

        // bcrypt.hash convierte el password en un hash seguro para guardar.
        usuario.password = await bcrypt.hash(usuario.password, salt);
      },
    },
    scopes: {
      // Este scope se usa en rutas privadas para no exponer datos sensibles.
      eliminarPassword: {
        attributes: {
          exclude: [
            "password",
            "token",
            "confirmado",
            "createdAt",
            "updatedAt",
          ],
        },
      },
    },
  },
);

// Metodo personalizado para comparar el password escrito con el hash guardado.
// bcrypt.compare devuelve una promesa, por eso el controlador debe usar await.
Usuario.prototype.verificarPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default Usuario;
