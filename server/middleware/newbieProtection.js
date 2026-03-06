/**
 * Checks if the target province is under newbie protection.
 * Used in attack routes. Expects req.targetProvince to be set.
 */
function checkNewbieProtection(req, res, next) {
  const target = req.targetProvince;
  if (!target) return next();

  if (target.protection_ends_at && new Date(target.protection_ends_at) > new Date()) {
    return res.status(403).json({
      error: 'This province is under a new player shield',
      protection_ends_at: target.protection_ends_at,
    });
  }
  next();
}

module.exports = checkNewbieProtection;
