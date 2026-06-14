import { Propiedad, Precio, Categoria } from "../models/index.js";

// Devuelve las propiedades publicadas que pueden mostrarse en el mapa publico.
// Seleccionar campos concretos evita exponer datos internos que el mapa no usa.
const propiedades = async (req, res) => {
  try {
    const propiedadesPublicadas = await Propiedad.findAll({
      where: {
        publicado: true,
      },
      attributes: ["id", "titulo", "imagen", "calle", "lat", "lng"],
      include: [
        {
          model: Precio,
          as: "precio",
          attributes: ["id", "precio"],
        },
        {
          model: Categoria,
          as: "categoria",
          attributes: ["id", "nombre"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Conservamos un arreglo directo para mantener el contrato sencillo del
    // curso: el frontend puede recorrer inmediatamente la respuesta con forEach.
    return res.status(200).json(propiedadesPublicadas);
  } catch (error) {
    console.error("No fue posible consultar las propiedades del mapa:", error);

    return res.status(500).json({
      propiedades: [],
      mensaje: "No fue posible cargar las propiedades en este momento.",
    });
  }
};

export { propiedades };
