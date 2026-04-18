import { Router } from "express";
import { changeEvent, removeEvent, getUpcomingEvents, getEventsByDate, getPastEvents, getAllEvents, loadNewEvents, loadNewEventsWebhook, search } from "../controller/eventController";


const router = Router();

router.put("/update/:eventId", changeEvent);
router.put("/remove/:eventId", removeEvent);
router.get("/upcoming", getUpcomingEvents);
router.get("/byDate/:date", getEventsByDate);
router.get("/past/:days", getPastEvents);
router.get("/all", getAllEvents);
router.get("/load", loadNewEvents);
router.get("/search", search);
router.post("/webhook", loadNewEventsWebhook);


export default router;