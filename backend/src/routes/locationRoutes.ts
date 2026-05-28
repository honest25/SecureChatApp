import { Router } from 'express';
import { updateLocation, manualCheckIn, getCurrentLocation, getRoomOccupancy } from '../controllers/locationController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();
router.use(requireAuth);

router.post('/update', updateLocation);
router.post('/check-in', manualCheckIn);
router.get('/current', getCurrentLocation);
router.get('/rooms/:roomId/active-users', getRoomOccupancy);

export default router;
