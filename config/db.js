import { Sequelize } from "sequelize";
import dotenv from "dotenv";

// Cargamos las variables definidas en el archivo .env.
// Esto nos permite no escribir credenciales directamente en el codigo.
dotenv.config({ path: ".env" });

// Funcion auxiliar para leer variables de entorno obligatorias.
// Si falta alguna, detenemos la aplicacion con un mensaje claro.
const obtenerVariableEntorno = (nombre) => {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`La variable de entorno ${nombre} es obligatoria`);
  }

  return valor;
};

// Variables necesarias para conectar con MySQL.
const database = obtenerVariableEntorno("BD_NOMBRE");
const username = obtenerVariableEntorno("BD_USER");
const password = process.env.BD_PASS ?? "";
const host = obtenerVariableEntorno("BD_HOST");
const port = Number(process.env.BD_PORT ?? 3306);

// Creamos la instancia de Sequelize.
// Sequelize es el ORM que nos permite trabajar con MySQL usando JavaScript.
const db = new Sequelize(database, username, password, {
  // Servidor donde esta instalada la base de datos.
  host,

  // Puerto de MySQL convertido a numero.
  port,

  // Indicamos que el motor de base de datos sera MySQL.
  dialect: "mysql",

  // Opciones globales para todos los modelos que creemos con Sequelize.
  define: {
    // Agrega automaticamente createdAt y updatedAt en las tablas.
    timestamps: true,
  },

  // Pool de conexiones:
  // Sequelize mantiene conexiones abiertas para reutilizarlas y mejorar rendimiento.
  pool: {
    // Numero maximo de conexiones abiertas al mismo tiempo.
    max: 5,

    // Numero minimo de conexiones que Sequelize intentara mantener.
    min: 0,

    // Tiempo maximo, en milisegundos, para intentar obtener una conexion.
    acquire: 30000,

    // Tiempo maximo, en milisegundos, que una conexion puede estar inactiva.
    idle: 10000,
  },
});

// Exportamos la conexion para usarla en index.js y en los modelos.
export default db;
