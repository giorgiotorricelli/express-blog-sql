import express from "express";
import { index, show, create, update, modify, destroy } from '../controllers/postControllers.js';
import {slugValidation, postValidation} from "../middlewares/errorHandler.js";

const router = express.Router();

router.get('/', index);
router.get('/:slug', slugValidation, show);
router.post('/', postValidation, create);
router.put('/:slug', slugValidation, postValidation, update);
router.patch('/:slug', slugValidation, modify);
router.delete('/:slug', slugValidation, destroy);


export default router;

