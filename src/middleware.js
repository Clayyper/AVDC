function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({
      error: "Acesso restrito ao administrador."
    });
  }

  next();
}

function requireUser(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "Acesso restrito ao usuário comum."
    });
  }

  next();
}

module.exports = {
  requireAdmin,
  requireUser
};
