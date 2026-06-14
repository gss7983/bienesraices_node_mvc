import { DataTypes, STRING } from "sequelize";
import db from "../config/db.js";

const Precio = db.define("precios", {
  precio: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },
});

export default Precio;
