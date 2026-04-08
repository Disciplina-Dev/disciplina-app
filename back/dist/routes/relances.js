"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companies_1 = require("../controllers/companies");
const router = (0, express_1.Router)();
router.get('/', companies_1.listAllRelances); // GET  /api/relances?commercial=...
router.put('/:id', companies_1.updateRelance); // PUT  /api/relances/:id
exports.default = router;
