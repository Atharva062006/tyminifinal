const { sendSuccess } = require('../../../../shared/response');
const { NotFoundError } = require('../../../../shared/errors');
const { v4: uuidv4 } = require('uuid');

class CompanyController {
  constructor(db) {
    this.db = db;
  }

  // POST /api/v1/companies
  create = async (req, res, next) => {
    try {
      const company = {
        company_id: req.body.company_id || `COM-${uuidv4().substring(0, 6).toUpperCase()}`,
        name: req.body.name,
        industry: req.body.industry,
        website: req.body.website,
        description: req.body.description,
        created_at: new Date().toISOString(),
      };
      Object.keys(company).forEach(k => company[k] === undefined && delete company[k]);
      const created = await this.db.table('companies').insert(company);
      sendSuccess(res, created, req.correlationId, 201);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v1/companies/:companyId
  update = async (req, res, next) => {
    try {
      const { companyId } = req.params;
      if (!this.db.table('companies').findById(companyId)) throw new NotFoundError('Company', companyId);
      const updates = {};
      for (const k of ['name', 'industry', 'website', 'description']) if (req.body[k] !== undefined) updates[k] = req.body[k];
      sendSuccess(res, await this.db.table('companies').update(companyId, updates), req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/companies
  list = (req, res, next) => {
    try {
      sendSuccess(res, this.db.table('companies').all(), req.correlationId);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v1/companies/:companyId
  get = (req, res, next) => {
    try {
      const company = this.db.table('companies').findById(req.params.companyId);
      if (!company) throw new NotFoundError('Company', req.params.companyId);
      sendSuccess(res, company, req.correlationId);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = CompanyController;
