import { Router } from 'express';
import { createRoom, getRoom, getRoomByCode, deleteRoom } from '../controllers/rooms.controller';

const router = Router();

router.post('/', createRoom);
router.get('/code/:code', getRoomByCode);
router.get('/:id', getRoom);
router.delete('/:id', deleteRoom);

export default router;
