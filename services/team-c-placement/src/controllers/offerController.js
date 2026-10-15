const { sendSuccess } = require('../../../../shared/response');

class OfferController {
  constructor(offerService) {
    this.offerService = offerService;
  }

  // POST /api/v1/internal/offers/commit
  commit = async (req, res, next) => {
    try {
      const { application_id, decision_result, target_state, lease_id, expected_version, payload } = req.body;
      const result = await this.offerService.commitOffer({
        applicationId: application_id,
        decisionResult: decision_result,
        targetState: target_state,
        leaseId: lease_id,
        expectedVersion: expected_version,
        correlationId: req.correlationId,
        actor: req.user ? req.user.id : 'system',
        payload,
      });
      sendSuccess(res, result, req.correlationId, 200);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v1/internal/offers/compensate
  compensate = async (req, res, next) => {
    try {
      const { application_id, reason, lease_id } = req.body;
      const result = await this.offerService.compensate({
        applicationId: application_id, reason, leaseId: lease_id,
        correlationId: req.correlationId, actor: req.user ? req.user.id : 'system',
      });
      sendSuccess(res, result, req.correlationId, 200);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = OfferController;
