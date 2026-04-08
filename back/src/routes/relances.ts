import { Router } from 'express'
import { listAllRelances, updateRelance } from '../controllers/companies'

const router = Router()

router.get('/',     listAllRelances)  // GET  /api/relances?commercial=...
router.put('/:id',  updateRelance)    // PUT  /api/relances/:id

export default router
