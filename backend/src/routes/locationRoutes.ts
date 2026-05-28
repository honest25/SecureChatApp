import { Router } from 'express';
import { updateLocation, manualCheckIn, manualCheckOut, getCurrentLocation, getNearbyUsers, getDistance, getRooms, getRoomOccupancy, simulateMovement } from '../controllers/locationController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();
router.use(requireAuth);

router.post('/update', updateLocation);
router.post('/check-in', manualCheckIn);
router.post('/check-out', manualCheckOut);
router.post('/simulate', simulateMovement);
router.get('/current', getCurrentLocation);
router.get('/nearby', getNearbyUsers);
router.get('/distance', getDistance);
router.get('/rooms', getRooms);
router.get('/rooms/:roomId/active-users', getRoomOccupancy);

export default router;
