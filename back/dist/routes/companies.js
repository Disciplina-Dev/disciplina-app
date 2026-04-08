"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companies_1 = require("../controllers/companies");
const router = (0, express_1.Router)();
// CRUD entreprises
router.get('/', companies_1.listCompanies); // GET  /api/companies
router.post('/', companies_1.createCompany); // POST /api/companies
router.get('/:id', companies_1.getCompany); // GET  /api/companies/:id
router.put('/:id', companies_1.updateCompany); // PUT  /api/companies/:id
router.delete('/:id', companies_1.deleteCompany); // DELETE /api/companies/:id
// Appels
router.get('/:id/calls', companies_1.listCalls); // GET  /api/companies/:id/calls
router.post('/:id/calls', companies_1.createCall); // POST /api/companies/:id/calls
// Relances d'une entreprise
router.get('/:id/relances', companies_1.listCompanyRelances); // GET  /api/companies/:id/relances
router.post('/:id/relances', companies_1.createRelance); // POST /api/companies/:id/relances
exports.default = router;
