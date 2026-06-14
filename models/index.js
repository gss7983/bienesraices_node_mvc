import Propiedad from "./Propiedad.js";
import Precio from "./Precio.js";
import Categoria from "./Categoria.js";
import Usuario from "./Usuario.js";
import Mensaje from "./Mensaje.js";

// Una propiedad pertenece a un rango de precio.
// Un precio puede estar asociado a muchas propiedades.
Precio.hasMany(Propiedad, {
  as: "propiedades",
  foreignKey: {
    name: "precioId",
    allowNull: false,
  },
});
Propiedad.belongsTo(Precio, {
  as: "precio",
  foreignKey: {
    name: "precioId",
    allowNull: false,
  },
});

// Una propiedad pertenece a una categoria.
// Una categoria puede estar asociada a muchas propiedades.
Categoria.hasMany(Propiedad, {
  as: "propiedades",
  foreignKey: {
    name: "categoriaId",
    allowNull: false,
  },
});
Propiedad.belongsTo(Categoria, {
  as: "categoria",
  foreignKey: {
    name: "categoriaId",
    allowNull: false,
  },
});

// Una propiedad pertenece al usuario que la publica.
// Un usuario puede publicar muchas propiedades.
Usuario.hasMany(Propiedad, {
  as: "propiedades",
  foreignKey: {
    name: "usuarioId",
    allowNull: false,
  },
});
Propiedad.belongsTo(Usuario, {
  as: "usuario",
  foreignKey: {
    name: "usuarioId",
    allowNull: false,
  },
});
// Una propiedad puede recibir muchos mensajes.
Propiedad.hasMany(Mensaje, {
  as: "mensajes",
  foreignKey: {
    name: "propiedadId",
    allowNull: false,
  },
  // Los mensajes dejan de tener sentido cuando se elimina el anuncio.
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Mensaje.belongsTo(Propiedad, {
  as: "propiedad",
  foreignKey: {
    name: "propiedadId",
    allowNull: false,
  },
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Un usuario autenticado puede escribir muchos mensajes.
Usuario.hasMany(Mensaje, {
  as: "mensajes",
  foreignKey: {
    name: "usuarioId",
    allowNull: false,
  },
});
Mensaje.belongsTo(Usuario, {
  as: "usuario",
  foreignKey: {
    name: "usuarioId",
    allowNull: false,
  },
});

export { Propiedad, Precio, Categoria, Usuario, Mensaje };
