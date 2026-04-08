import { Router } from 'express'
import { submitAB } from '../controllers/abController'

const router = Router()

router.post('/submit', submitAB)

export default router
