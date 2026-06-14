import { Dropzone } from "dropzone";

// Evita que Dropzone intente inicializar automaticamente todos los formularios.
Dropzone.autoDiscover = false;

const formularioImagen = document.querySelector("#agregar-imagen");
const botonPublicar = document.querySelector("#publicar-propiedad");

if (formularioImagen) {
  const csrfToken = formularioImagen.querySelector(
    'input[name="_csrf"]',
  )?.value;

  const clasesBotonActivo =
    "inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-800 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-200 sm:w-auto";

  const clasesBotonInactivo =
    "inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-slate-300 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-500 shadow-sm sm:w-auto";

  const actualizarBoton = (activo) => {
    if (!botonPublicar) return;

    botonPublicar.disabled = !activo;
    botonPublicar.className = activo ? clasesBotonActivo : clasesBotonInactivo;
  };

  const mostrarError = (mensaje) => {
    formularioImagen.querySelector("[data-error-imagen]")?.remove();

    const error = document.createElement("p");
    error.dataset.errorImagen = "true";
    error.className =
      "mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700";
    error.textContent = mensaje;
    formularioImagen.appendChild(error);
  };

  const dropzone = new Dropzone(formularioImagen, {
    paramName: "imagen",
    acceptedFiles: "image/jpeg,image/png,image/webp",
    maxFiles: 1,
    maxFilesize: 5,
    addRemoveLinks: true,
    dictRemoveFile: "Eliminar imagen",
    dictInvalidFileType: "Selecciona una imagen JPG, PNG o WebP",
    dictFileTooBig: "La imagen supera el limite de 5 MB",
    dictMaxFilesExceeded: "Solo puedes seleccionar una imagen",
    headers: csrfToken ? { "CSRF-Token": csrfToken } : {},

    // El archivo se envia cuando el usuario presiona Publicar Propiedad.
    autoProcessQueue: false,
  });

  dropzone.on("addedfile", () => {
    // Si se elige otra imagen, reemplazamos la anterior.
    if (dropzone.files.length > 1) {
      dropzone.removeFile(dropzone.files[0]);
    }

    // Dropzone establece la propiedad accepted despues de agregar el archivo.
    window.setTimeout(() => {
      actualizarBoton(dropzone.getAcceptedFiles().length > 0);
    }, 0);
  });

  dropzone.on("removedfile", () => {
    actualizarBoton(dropzone.getAcceptedFiles().length > 0);
  });

  dropzone.on("sending", () => {
    actualizarBoton(false);

    if (botonPublicar) {
      botonPublicar.textContent = "Publicando...";
    }
  });

  dropzone.on("success", (archivo, respuesta) => {
    window.location.assign(respuesta?.redirect || "/mis-propiedades");
  });

  dropzone.on("error", (archivo, respuesta) => {
    const mensaje =
      typeof respuesta === "string"
        ? respuesta
        : respuesta?.mensaje || "No fue posible subir la imagen";

    mostrarError(mensaje);

    if (botonPublicar) {
      botonPublicar.textContent = "Publicar Propiedad";
    }

    actualizarBoton(dropzone.getAcceptedFiles().length > 0);
  });

  botonPublicar?.addEventListener("click", () => {
    if (!dropzone.getAcceptedFiles().length) {
      mostrarError("Selecciona una imagen antes de publicar");
      return;
    }

    dropzone.processQueue();
  });
}
