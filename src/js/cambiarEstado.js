// Mejora progresiva del formulario para publicar o pausar una propiedad.
// Si JavaScript falla, el formulario POST continúa funcionando normalmente.
(() => {
  const formularios = document.querySelectorAll("[data-cambiar-estado]");
  const contenedorMensaje = document.querySelector("[data-estado-mensaje]");
  const totalPublicadas = document.querySelector("[data-total-publicadas]");

  if (!formularios.length) {
    return;
  }

  const clasesIndicador = {
    publicado: [
      "border-emerald-300",
      "bg-emerald-50",
      "text-emerald-700",
    ],
    pausado: ["border-amber-300", "bg-amber-50", "text-amber-700"],
  };

  const clasesBoton = {
    publicar: [
      "border-emerald-500",
      "text-emerald-700",
      "hover:bg-emerald-50",
      "focus:ring-emerald-100",
    ],
    pausar: [
      "border-amber-400",
      "text-amber-700",
      "hover:bg-amber-50",
      "focus:ring-amber-100",
    ],
  };

  const mostrarMensaje = (mensaje, esError = false) => {
    if (!contenedorMensaje) {
      return;
    }

    contenedorMensaje.textContent = mensaje;
    contenedorMensaje.classList.remove(
      "hidden",
      "border-red-200",
      "bg-red-50",
      "text-red-700",
      "border-emerald-200",
      "bg-emerald-50",
      "text-emerald-800",
    );
    contenedorMensaje.classList.add(
      ...(esError
        ? ["border-red-200", "bg-red-50", "text-red-700"]
        : ["border-emerald-200", "bg-emerald-50", "text-emerald-800"]),
    );
  };

  const actualizarControles = (formulario, publicado) => {
    const { propiedadId } = formulario.dataset;
    const estabaPublicado = formulario.dataset.publicado === "true";
    const boton = formulario.querySelector("[data-estado-boton]");
    const indicador = document.querySelector(
      `[data-estado-indicador="${propiedadId}"]`,
    );
    const titulo = document.querySelector(
      `[data-propiedad-titulo="${propiedadId}"]`,
    );

    if (!boton || !indicador) {
      return;
    }

    indicador.classList.remove(
      ...clasesIndicador.publicado,
      ...clasesIndicador.pausado,
    );
    indicador.classList.add(
      ...(publicado
        ? clasesIndicador.publicado
        : clasesIndicador.pausado),
    );
    indicador.textContent = publicado ? "Publicada" : "Pausada";

    boton.classList.remove(...clasesBoton.publicar, ...clasesBoton.pausar);
    boton.classList.add(
      ...(publicado ? clasesBoton.pausar : clasesBoton.publicar),
    );
    boton.textContent = publicado ? "Pausar anuncio" : "Publicar anuncio";
    formulario.dataset.publicado = String(publicado);

    // Solo los anuncios publicados deben enlazar a su detalle público.
    if (titulo) {
      const textoTitulo = titulo.textContent.trim();
      titulo.replaceChildren();

      if (publicado) {
        const enlace = document.createElement("a");
        enlace.href = `/propiedad/${propiedadId}`;
        enlace.className =
          "text-slate-900 outline-none transition hover:text-emerald-700 focus:text-emerald-700 focus:underline";
        enlace.textContent = textoTitulo;
        titulo.append(enlace);
      } else {
        titulo.textContent = textoTitulo;
      }
    }

    if (totalPublicadas && estabaPublicado !== publicado) {
      const totalActual = Number.parseInt(totalPublicadas.textContent, 10) || 0;
      totalPublicadas.textContent = String(
        Math.max(0, totalActual + (publicado ? 1 : -1)),
      );
    }
  };

  const cambiarEstado = async (event) => {
    event.preventDefault();

    const formulario = event.currentTarget;
    const boton = formulario.querySelector("[data-estado-boton]");
    const datos = new FormData(formulario);
    const token = datos.get("_csrf");

    if (!boton || !token) {
      formulario.submit();
      return;
    }

    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");

    try {
      const respuesta = await fetch(formulario.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "CSRF-Token": token,
        },
        credentials: "same-origin",
      });

      // Una redirección suele indicar que la sesión terminó.
      if (respuesta.redirected) {
        window.location.assign(respuesta.url);
        return;
      }

      const datosRespuesta = await respuesta.json();

      if (!respuesta.ok || !datosRespuesta.resultado) {
        throw new Error(
          datosRespuesta.mensaje || "No fue posible actualizar la propiedad.",
        );
      }

      actualizarControles(formulario, datosRespuesta.publicado);
      mostrarMensaje(datosRespuesta.mensaje);
    } catch (error) {
      mostrarMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar la propiedad.",
        true,
      );
    } finally {
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
    }
  };

  formularios.forEach((formulario) => {
    formulario.addEventListener("submit", cambiarEstado);
  });
})();
