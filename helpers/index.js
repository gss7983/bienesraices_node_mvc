const esVendedor = (usuarioId, propiedadUsuarioId) => {
  // Sequelize y JWT pueden entregar identificadores con tipos distintos.
  // Si no hay usuario autenticado, el visitante nunca puede ser el vendedor.
  if (!usuarioId || !propiedadUsuarioId) {
    return false;
  }

  return String(usuarioId) === String(propiedadUsuarioId);
};

const formatearFecha = (fecha) => {
  const nuevaFecha = new Date(fecha).toISOString().slice(0, 10);

  const opciones = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return new Date(nuevaFecha).toLocaleString("es-MX", opciones);
};

export { esVendedor, formatearFecha };
