// Confirma las eliminaciones desde un archivo externo.
// Esto evita scripts inline que serian bloqueados por Content-Security-Policy.
const formulariosEliminar = document.querySelectorAll("[data-eliminar-propiedad]");
const mensajeTemporal = document.querySelector("[data-mensaje-temporal]");

// Las confirmaciones de una accion desaparecen despues de cuatro segundos.
// Primero reducimos su opacidad y despues retiramos el elemento del documento.
if (mensajeTemporal) {
  window.setTimeout(() => {
    mensajeTemporal.classList.add("opacity-0");

    window.setTimeout(() => {
      mensajeTemporal.remove();
    }, 500);
  }, 4000);
}

formulariosEliminar.forEach((formulario) => {
  formulario.addEventListener("submit", (event) => {
    const confirmado = window.confirm(
      "¿Deseas eliminar esta propiedad? Esta accion no se puede deshacer.",
    );

    if (!confirmado) {
      event.preventDefault();
    }
  });
});
