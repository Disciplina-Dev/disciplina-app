import { Router } from 'express'
import { sendToYousign, yousignWebhook } from '../controllers/yousignController'

const router = Router()

router.post('/send', sendToYousign)
router.post('/webhook', yousignWebhook)

export default router
