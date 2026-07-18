module.exports = function requireOrganizer(req, res, next) {
  if (!req.user || !req.user.is_organizer) {
    return res.status(403).json({ error: "Organizer account required." });
  }
  next();
};
