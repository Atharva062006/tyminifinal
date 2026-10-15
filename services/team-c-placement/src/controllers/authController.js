const { sendSuccess } = require('../../../../shared/response');

class AuthController {
  constructor(authService) { this.auth = authService; }

  register = async (req, res, next) => {
    try { sendSuccess(res, await this.auth.registerStudent(req.body || {}, req.correlationId), req.correlationId, 201); } catch (e) { next(e); }
  };

  login = async (req, res, next) => {
    try { sendSuccess(res, await this.auth.login(req.body || {}, req.correlationId), req.correlationId); } catch (e) { next(e); }
  };

  me = (req, res, next) => {
    try { sendSuccess(res, this.auth.me(req.user.user_id || req.user.id), req.correlationId); } catch (e) { next(e); }
  };

  changePassword = async (req, res, next) => {
    try { sendSuccess(res, await this.auth.changePassword(req.user.user_id || req.user.id, req.body || {}), req.correlationId); } catch (e) { next(e); }
  };

  listUsers = (req, res, next) => {
    try { sendSuccess(res, this.auth.listUsers(), req.correlationId); } catch (e) { next(e); }
  };

  createUser = async (req, res, next) => {
    try { sendSuccess(res, await this.auth.createStaff(req.body || {}, req.user.id, req.correlationId), req.correlationId, 201); } catch (e) { next(e); }
  };

  updateUser = async (req, res, next) => {
    try { sendSuccess(res, await this.auth.updateUser(req.params.userId, req.body || {}, req.user.id, req.correlationId), req.correlationId); } catch (e) { next(e); }
  };
}

module.exports = AuthController;
