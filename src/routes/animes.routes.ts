import { Router } from 'express';
import { getAnimes, getGenres, getScreenshots, checkAnimes } from '../controllers/animes.controller';

const router = Router();

router.get('/', getAnimes);
router.get('/genres', getGenres);
router.get('/check', checkAnimes);
router.get('/:id/screenshots', getScreenshots);

export default router;
