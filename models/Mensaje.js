import { DataTypes } from "sequelize";
import db from "../config/db.js";

const Mensaje = db.define("mensajes", {
  mensaje: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  // Permite al vendedor distinguir consultas nuevas de las ya atendidas.
  leido: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Propiedad sobre la que se envia el mensaje.
  propiedadId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Usuario autenticado que envia el mensaje.
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

export default Mensaje;
