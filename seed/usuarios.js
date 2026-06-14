import bcrypt from "bcrypt";

// bulkCreate no ejecuta beforeCreate por cada registro de forma predeterminada.
// Por eso el password del usuario semilla se cifra antes de exportarlo.
const password = bcrypt.hashSync("password222", 10);

const usuarios = [
  {
    nombre: "Casimiro",
    email: "simam60231@hitzcart.com",
    confirmado: true,
    password,
  },
];

export default usuarios;
