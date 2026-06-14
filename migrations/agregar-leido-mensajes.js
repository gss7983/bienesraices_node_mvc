import { DataTypes } from "sequelize";
import db from "../config/db.js";

const agregarEstadoLeido = async () => {
  try {
    await db.authenticate();

    const queryInterface = db.getQueryInterface();
    const columnas = await queryInterface.describeTable("mensajes");

    // La comprobación permite ejecutar esta migración más de una vez.
    if (!columnas.leido) {
      await queryInterface.addColumn("mensajes", "leido", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log("Columna mensajes.leido creada correctamente.");
    } else {
      console.log("La columna mensajes.leido ya existe.");
    }
  } catch (error) {
    console.error("No fue posible actualizar la tabla mensajes:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
};

await agregarEstadoLeido();
