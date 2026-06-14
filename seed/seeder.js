import categorias from "./categorias.js";
import precios from "./precios.js";
import usuarios from "./usuarios.js";
import db from "../config/db.js";
import { Categoria, Precio, Usuario } from "../models/index.js";

const importarDatos = async () => {
  try {
    // Autentica la conexion antes de modificar la base de datos.
    await db.authenticate();

    // Sincroniza los modelos para asegurar que las tablas existan.
    await db.sync();

    // La transaccion evita una importacion parcial si alguno de los datos falla.
    await db.transaction(async (transaction) => {
      // validate comprueba cada objeto antes de enviarlo a MySQL.
      await Promise.all([
        Categoria.bulkCreate(categorias, { validate: true, transaction }),
        Precio.bulkCreate(precios, { validate: true, transaction }),
        Usuario.bulkCreate(usuarios, { validate: true, transaction }),
      ]);
    });

    console.log("Datos importados correctamente");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Cerramos la conexion para que el proceso termine de forma ordenada.
    await db.close();
  }
};

const eliminarDatos = async () => {
  try {
    // Autentica la conexion antes de eliminar registros.
    await db.authenticate();

    // Elimina primero los registros semilla de estas tablas.
    // await Promise.all([
    //   Categoria.destroy({ where: {}, truncate: true }),
    //   Precio.destroy({ where: {}, truncate: true }),
    // ]);

    await db.sync({ force: true });

    console.log("Datos eliminados correctamente");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Cerramos la conexion para que el proceso termine de forma ordenada.
    await db.close();
  }
};

if (process.argv[2] === "-i") {
  importarDatos();
}

if (process.argv[2] === "-e") {
  eliminarDatos();
}
