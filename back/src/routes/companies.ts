import { Router } from 'express'
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  listCalls,
  createCall,
  listCompanyRelances,
  createRelance,
} from '../controllers/companies'

const router = Router()

// CRUD entreprises
router.get('/',       listCompanies)   // GET  /api/companies
router.post('/',      createCompany)   // POST /api/companies
router.get('/:id',    getCompany)      // GET  /api/companies/:id
router.put('/:id',    updateCompany)   // PUT  /api/companies/:id
router.delete('/:id', deleteCompany)   // DELETE /api/companies/:id

// Appels
router.get('/:id/calls',  listCalls)   // GET  /api/companies/:id/calls
router.post('/:id/calls', createCall)  // POST /api/companies/:id/calls

// Relances d'une entreprise
router.get('/:id/relances',  listCompanyRelances) // GET  /api/companies/:id/relances
router.post('/:id/relances', createRelance)       // POST /api/companies/:id/relances

export default router
